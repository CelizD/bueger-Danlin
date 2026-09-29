import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";
import { refundLatePaymentFromAdmin } from "./admin-late-payment-refund.js";

const CANCELLED_STATUSES = ["CANCELLED", "REFUNDED"] as const;

function metadataRecord(
  metadata: unknown,
): Record<string, unknown> {
  return metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function activePaidOrder(order: {
  status: string;
  paymentStatus: string;
}) {
  return (
    order.paymentStatus === "PAID" &&
    !CANCELLED_STATUSES.includes(
      order.status as (typeof CANCELLED_STATUSES)[number],
    )
  );
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviders: PaymentProviderRegistry,
  ) {}

  refundLatePayment(
    orderCode: string,
    actorUserId: string,
  ) {
    return refundLatePaymentFromAdmin(
      this.prisma,
      this.paymentProviders,
      orderCode,
      actorUserId,
    );
  }

  async listOrders() {
    const [events, orders] = await Promise.all([
      this.prisma.pickupEvent.findMany({
        orderBy: { startsAt: "desc" },
        take: 30,
        include: {
          pickupPoint: {
            select: {
              id: true,
              code: true,
              name: true,
              address: true,
            },
          },
          orders: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              groupDeliveryFinalFeeCents: true,
            },
          },
        },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          customer: {
            select: {
              name: true,
              phone: true,
              email: true,
            },
          },
          pickupEvent: {
            select: {
              id: true,
              code: true,
              name: true,
              locationLabel: true,
              startsAt: true,
              closesAt: true,
              timezone: true,
              pickupPoint: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  address: true,
                },
              },
            },
          },
          items: {
            orderBy: { id: "asc" },
            include: {
              modifiers: {
                orderBy: { id: "asc" },
              },
            },
          },
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              from: true,
              to: true,
              note: true,
              createdAt: true,
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              provider: true,
              status: true,
              amountCents: true,
              paidAt: true,
              refundedAt: true,
              metadata: true,
            },
          },
        },
      }),
    ]);

    const groups = events.map((event) => {
      const paidOrders = event.orders.filter(activePaidOrder);
      const finalized = !!event.groupDeliveryFinalizedAt;
      const paidOrderCount = finalized
        ? event.groupDeliveryFinalPaidCombos ?? paidOrders.length
        : paidOrders.length;
      const freeDeliveryUnlocked = finalized
        ? event.groupDeliveryFinalFreeUnlocked ?? false
        : paidOrderCount >= event.freeDeliveryMinPaidCombos;

      const estimatedFeeCents = finalized
        ? null
        : freeDeliveryUnlocked
          ? 0
          : paidOrderCount > 0
            ? Math.ceil(
                event.transportCostCents / paidOrderCount,
              )
            : null;

      const cashToCollectCents = finalized
        ? paidOrders.reduce(
            (sum, order) =>
              sum + (order.groupDeliveryFinalFeeCents ?? 0),
            0,
          )
        : 0;

      return {
        eventId: event.id,
        eventCode: event.code,
        eventName: event.name,
        status: event.status,
        startsAt: event.startsAt,
        closesAt: event.closesAt,
        pickupPoint: event.pickupPoint,
        minPaidOrders: event.freeDeliveryMinPaidCombos,
        paidOrderCount,
        remainingPaidOrders: Math.max(
          0,
          event.freeDeliveryMinPaidCombos - paidOrderCount,
        ),
        transportCostCents: finalized
          ? event.groupDeliveryFinalTransportCostCents ??
            event.transportCostCents
          : event.transportCostCents,
        estimatedFeeCents,
        freeDeliveryUnlocked,
        finalized,
        finalizedAt: event.groupDeliveryFinalizedAt,
        finalAssignedCents:
          event.groupDeliveryFinalAssignedCents,
        cashToCollectCents,
      };
    });

    const presentedOrders = orders.map(
      (order) => {
        const paymentNeedingRefund =
          order.payments.find(
            (payment) =>
              payment.status === "PAID" &&
              metadataRecord(
                payment.metadata,
              ).requiresManualRefund ===
                true,
          );
        const refundMetadata =
          paymentNeedingRefund
            ? metadataRecord(
                paymentNeedingRefund.metadata,
              )
            : null;

        return {
          ...order,
          refundIssue:
            paymentNeedingRefund &&
            refundMetadata
              ? {
                  required: true,
                  amountCents:
                    paymentNeedingRefund.amountCents,
                  provider:
                    paymentNeedingRefund.provider,
                  reason:
                    typeof refundMetadata
                      .latePaymentReason ===
                    "string"
                      ? refundMetadata
                          .latePaymentReason
                      : "LATE_PAYMENT",
                  detectedAt:
                    typeof refundMetadata
                      .latePaymentDetectedAt ===
                    "string"
                      ? refundMetadata
                          .latePaymentDetectedAt
                      : null,
                  lastAttemptFailed:
                    refundMetadata
                      .manualRefundStatus ===
                    "FAILED",
                }
              : null,
          payments:
            order.payments.map(
              ({
                metadata: _metadata,
                ...payment
              }) => payment,
            ),
        };
      },
    );

    const effectiveSales =
      presentedOrders.filter(
        activePaidOrder,
      );
    const refundOrders =
      presentedOrders.filter(
        (order) =>
          order.refundIssue?.required,
      );

    const summary = {
      totalOrders: orders.length,
      paidOrders: effectiveSales.length,
      pendingOrders: orders.filter(
        (order) =>
          order.paymentStatus === "PENDING" &&
          order.status !== "CANCELLED",
      ).length,
      totalCombos: effectiveSales.reduce(
        (total, order) => total + order.comboQuantity,
        0,
      ),
      paidRevenueCents: effectiveSales.reduce(
        (total, order) => total + order.totalCents,
        0,
      ),
      finalDeliveryCashCents: groups.reduce(
        (total, group) => total + group.cashToCollectCents,
        0,
      ),
      activeGroups: groups.filter(
        (group) =>
          !group.finalized &&
          ["OPEN", "SOLD_OUT"].includes(group.status),
      ).length,
      manualRefundsPending:
        refundOrders.length,
      manualRefundsPendingCents:
        refundOrders.reduce(
          (total, order) =>
            total +
            (order.refundIssue?.amountCents ??
              0),
          0,
        ),
    };

    return {
      summary,
      groups,
      orders: presentedOrders,
    };
  }
}
