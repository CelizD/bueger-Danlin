import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";
import { cancelCustomerOrder } from "./customer-order-cancellation.js";
import { processCustomerRefund } from "./customer-order-refund-processing.js";
import { hasRefundRequest } from "./customer-order-refund.js";
import { assertOrderVerificationToken } from "./customer-order-security.js";
import { buildCustomerOrderReceiptPdf } from "./customer-order-receipt.js";

const TERMINAL_STATUSES = [
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "NO_SHOW",
] as const;

@Injectable()
export class CustomerOrdersService {
  private readonly logger = new Logger(CustomerOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly telegram?: TelegramNotificationService,
    private readonly paymentProviderRegistry?: PaymentProviderRegistry,
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

    const paidOrders = finalized
      ? []
      : await this.prisma.order.findMany({
          where: {
            pickupEventId: order.pickupEventId,
            paymentStatus: "PAID",
            status: {
              notIn: ["CANCELLED", "REFUNDED"],
            },
          },
          select: {
            comboQuantity: true,
          },
        });
    const paidOrderCount =
      paidOrders.length;
    const paidComboCount = finalized
      ? order.pickupEvent
          .groupDeliveryFinalPaidCombos ?? 0
      : paidOrders.reduce(
          (sum, paidOrder) =>
            sum + paidOrder.comboQuantity,
          0,
        );

    const freeDeliveryUnlocked = finalized
      ? order.pickupEvent.groupDeliveryFinalFreeUnlocked ?? false
      : paidComboCount >=
        order.pickupEvent.freeDeliveryMinPaidCombos;

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
      purchaseTermsVersion:
        order.purchaseTermsVersion,
      purchaseTermsAcceptedAt:
        order.purchaseTermsAcceptedAt,
      payment: latestPayment
        ? {
            provider:
              latestPayment.provider,
            paidAt:
              latestPayment.paidAt,
            refundedAt:
              latestPayment.refundedAt,
          }
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
          latitude: order.pickupEvent.pickupPoint.latitude,
          longitude: order.pickupEvent.pickupPoint.longitude,
        },
      },
      groupDelivery: {
        minPaidCombos:
          order.pickupEvent.freeDeliveryMinPaidCombos,
        paidComboCount,
        remainingPaidCombos: Math.max(
          0,
          order.pickupEvent.freeDeliveryMinPaidCombos -
            paidComboCount,
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
        preparationSnapshot:
          item.preparationSnapshot,
        modifiers: item.modifiers.map((modifier) => ({
          id: modifier.id,
          optionName: modifier.optionName,
          removed: modifier.removed,
          priceDeltaCents: modifier.priceDeltaCents,
          quantity: modifier.quantity,
        })),
      })),
    };
  }


  async getReceipt(
    orderCodeInput: string,
    verificationToken: string,
  ) {
    const order = await this.getOrder(
      orderCodeInput,
      verificationToken,
    );
    const pdf =
      buildCustomerOrderReceiptPdf(
        order,
      );

    return {
      filename:
        "comprobante-" +
        order.orderCode +
        ".pdf",
      pdf,
    };
  }

  async cancel(
    orderCodeInput: string,
    verificationToken: string,
  ) {
    const {
      result,
      cancellationNotice,
      refundRequest,
    } = await cancelCustomerOrder(
      this.prisma,
      this.inventory,
      orderCodeInput,
      verificationToken,
    );

    let finalResult = result;
    let finalNotice = cancellationNotice;

    if (
      refundRequest &&
      this.paymentProviderRegistry
    ) {
      try {
        const refundResult =
          await processCustomerRefund(
            this.prisma,
            this.paymentProviderRegistry,
            refundRequest,
          );

        finalResult = {
          ...result,
          ...refundResult,
        };

        if (finalNotice) {
          finalNotice = {
            ...finalNotice,
            refundStatus: "REFUNDED",
          };
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "unknown refund provider error";

        this.logger.warn(
          `Refund remains pending for ${refundRequest.orderCode}: ${message}`,
        );
      }
    }

    if (finalNotice) {
      this.telegram?.notifyCancelled(finalNotice);
    }

    return finalResult;
  }
}
