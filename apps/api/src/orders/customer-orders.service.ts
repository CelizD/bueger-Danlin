import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import { cancelCustomerOrder } from "./customer-order-cancellation.js";
import { hasRefundRequest } from "./customer-order-refund.js";
import { assertOrderVerificationToken } from "./customer-order-security.js";

const TERMINAL_STATUSES = [
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "NO_SHOW",
] as const;

@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly telegram?: TelegramNotificationService,
  ) {}

  async getOrder(
    orderCodeInput: string,
    verificationToken: string,
  ) {
    const orderCode = orderCodeInput.trim().toUpperCase();
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
      include: {
        pickupEvent: {
          include: {
            pickupPoint: true,
          },
        },
        items: {
          orderBy: { id: "asc" },
          include: {
            modifiers: { orderBy: { id: "asc" } },
          },
        },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      throw new NotFoundException("El pedido no existe.");
    }

    assertOrderVerificationToken(
      order.verificationTokenHash,
      verificationToken,
    );

    const now = new Date();
    const canCancel =
      !order.pickupEvent.groupDeliveryFinalizedAt &&
      order.pickupEvent.status !== "CLOSED" &&
      now < order.pickupEvent.closesAt &&
      !TERMINAL_STATUSES.includes(
        order.status as (typeof TERMINAL_STATUSES)[number],
      );

    const latestPayment = order.payments[0] ?? null;
    const refundRequested = hasRefundRequest(
      latestPayment?.metadata,
    );

    const finalized =
      !!order.pickupEvent.groupDeliveryFinalizedAt;

    const paidOrderCount = finalized
      ? order.pickupEvent.groupDeliveryFinalPaidOrders ?? 0
      : await this.prisma.order.count({
          where: {
            pickupEventId: order.pickupEventId,
            paymentStatus: "PAID",
            status: {
              notIn: ["CANCELLED", "REFUNDED"],
            },
          },
        });

    const freeDeliveryUnlocked = finalized
      ? order.pickupEvent.groupDeliveryFinalFreeUnlocked ?? false
      : paidOrderCount >=
        order.pickupEvent.freeDeliveryMinPaidOrders;

    const estimatedDeliveryFeeCents = finalized
      ? order.groupDeliveryFinalFeeCents
      : freeDeliveryUnlocked
        ? 0
        : paidOrderCount > 0
          ? Math.ceil(
              order.pickupEvent.transportCostCents /
                paidOrderCount,
            )
          : null;

    return {
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      totalCents: order.totalCents,
      comboQuantity: order.comboQuantity,
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt,
      canCancel,
      cancellationDeadline: order.pickupEvent.closesAt,
      refundStatus:
        order.paymentStatus === "REFUNDED"
          ? "REFUNDED"
          : refundRequested
            ? "PENDING"
            : null,
      pickup: {
        locationLabel: order.pickupEvent.locationLabel,
        startsAt: order.pickupEvent.startsAt,
        closesAt: order.pickupEvent.closesAt,
        timezone: order.pickupEvent.timezone,
        pickupPoint: {
          code: order.pickupEvent.pickupPoint.code,
          name: order.pickupEvent.pickupPoint.name,
          address: order.pickupEvent.pickupPoint.address,
        },
      },
      groupDelivery: {
        minPaidOrders:
          order.pickupEvent.freeDeliveryMinPaidOrders,
        paidOrderCount,
        remainingPaidOrders: Math.max(
          0,
          order.pickupEvent.freeDeliveryMinPaidOrders -
            paidOrderCount,
        ),
        transportCostCents: finalized
          ? order.pickupEvent
              .groupDeliveryFinalTransportCostCents ??
            order.pickupEvent.transportCostCents
          : order.pickupEvent.transportCostCents,
        estimatedDeliveryFeeCents,
        freeDeliveryUnlocked,
        finalized,
        finalizedAt:
          order.pickupEvent.groupDeliveryFinalizedAt,
        finalFeeCents: order.groupDeliveryFinalFeeCents,
      },
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
        modifiers: item.modifiers.map((modifier) => ({
          id: modifier.id,
          optionName: modifier.optionName,
          removed: modifier.removed,
          priceDeltaCents: modifier.priceDeltaCents,
        })),
      })),
    };
  }

  async cancel(
    orderCodeInput: string,
    verificationToken: string,
  ) {
    const { result, cancellationNotice } =
      await cancelCustomerOrder(
        this.prisma,
        this.inventory,
        orderCodeInput,
        verificationToken,
      );

    if (cancellationNotice) {
      this.telegram?.notifyCancelled(cancellationNotice);
    }

    return result;
  }
}
