import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import type { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import type { ProviderPaymentStatus } from "./domain/payment-provider.types.js";
import type { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { shouldApplyPaymentStatus } from "./payment-webhook-status.js";

type MercadoPagoWebhookReconcileDependencies = {
  prisma: PrismaService;
  inventory: InventoryService;
  providers: PaymentProviderRegistry;
  telegram?: TelegramNotificationService;
  groupTelegram?: GroupTelegramNotificationService;
};

function mergePaymentMetadata(
  metadata: unknown,
  additions: Prisma.InputJsonObject,
): Prisma.InputJsonObject {
  const base: Prisma.InputJsonObject =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
      ? (metadata as Prisma.InputJsonObject)
      : {};

  return {
    ...base,
    ...additions,
  };
}

export async function reconcileMercadoPagoWebhook(
  dependencies: MercadoPagoWebhookReconcileDependencies,
  webhookEventId: string,
  resourceId: string,
) {
  const {
    prisma,
    inventory,
    providers,
    telegram,
    groupTelegram,
  } = dependencies;
  const payment = await prisma.payment.findFirst({
    where: {
      provider: "MERCADOPAGO",
      externalId: resourceId,
    },
    select: {
      id: true,
    },
  });

  if (!payment) {
    throw new NotFoundException(
      "El webhook no corresponde a un pago conocido.",
    );
  }

  const provider = providers.get("mercadopago");
  const canonical = await provider.getPayment(resourceId);

  if (canonical.externalId !== resourceId) {
    throw new ConflictException(
      "Mercado Pago devolvió un recurso diferente.",
    );
  }

  let paymentNotice:
    | {
        orderCode: string;
        comboQuantity: number;
        totalCents: number;
        currency: string;
        locationLabel?: string;
        pickupEventId: string;
      }
    | undefined;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${payment.id}
      FOR UPDATE
    `;

    const current = await tx.payment.findUnique({
      where: { id: payment.id },
      include: {
        order: {
          include: {
            pickupEvent: true,
          },
        },
      },
    });

    if (!current) {
      throw new NotFoundException("El pago ya no existe.");
    }

    if (
      canonical.amountCents !== current.amountCents ||
      canonical.currency !== current.currency
    ) {
      throw new ConflictException(
        "Monto o moneda del webhook no coincide con el pago.",
      );
    }

    const currentStatus =
      current.status as ProviderPaymentStatus;
    const incomingStatus = canonical.status;

    if (
      !shouldApplyPaymentStatus(
        currentStatus,
        incomingStatus,
      )
    ) {
      await tx.paymentWebhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status:
            currentStatus === incomingStatus
              ? "PROCESSED"
              : "IGNORED",
          processedAt: new Date(),
        },
      });

      if (currentStatus !== incomingStatus) {
        await tx.auditLog.create({
          data: {
            action: "PAYMENT_WEBHOOK_IGNORED",
            entityType: "Payment",
            entityId: current.id,
            before: { status: currentStatus },
            after: {
              incomingStatus,
              reason: "NON_FORWARD_TRANSITION",
            },
          },
        });
      }

      return {
        applied: false,
        paymentStatus: currentStatus,
      };
    }

    const now = new Date();
    const order = current.order;
    const reservationExpired =
      order.status === "PENDING_PAYMENT" &&
      (!order.reservationExpiresAt ||
        order.reservationExpiresAt <= now);
    const latePaid =
      incomingStatus === "PAID" &&
      (order.status !== "PENDING_PAYMENT" ||
        reservationExpired);

    const paymentData: {
      status: ProviderPaymentStatus;
      paidAt?: Date;
      refundedAt?: Date;
      metadata?: Prisma.InputJsonValue;
    } = {
      status: incomingStatus,
    };

    if (incomingStatus === "PAID") {
      paymentData.paidAt = canonical.paidAt ?? now;

      if (latePaid) {
        paymentData.metadata = mergePaymentMetadata(
          current.metadata,
          {
            latePaymentDetectedAt: now.toISOString(),
            latePaymentOrderStatus: order.status,
            latePaymentReason: reservationExpired
              ? "RESERVATION_EXPIRED"
              : "ORDER_ALREADY_CLOSED",
            ...(reservationExpired &&
            order.reservationExpiresAt
              ? {
                  reservationExpiredAt:
                    order.reservationExpiresAt.toISOString(),
                }
              : {}),
            requiresManualRefund: true,
          },
        );
      }
    }

    if (incomingStatus === "REFUNDED") {
      paymentData.refundedAt = now;
    }

    await tx.payment.update({
      where: { id: current.id },
      data: paymentData,
    });

    if (
      incomingStatus === "PAID" &&
      reservationExpired
    ) {
      await inventory.releaseOrder(
        tx,
        order.id,
      );

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "PAID",
          reservationExpiresAt: null,
          cancelledAt:
            order.cancelledAt ?? now,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: "PENDING_PAYMENT",
          to: "CANCELLED",
          note:
            "Pago recibido después de vencer la reserva. El pedido no se reactivó y requiere reembolso.",
        },
      });

      await tx.auditLog.create({
        data: {
          action:
            "PAYMENT_LATE_AFTER_ORDER_CLOSED",
          entityType: "Payment",
          entityId: current.id,
          before: {
            orderStatus: order.status,
            paymentStatus:
              order.paymentStatus,
            providerStatus:
              currentStatus,
            reservationExpiresAt:
              order.reservationExpiresAt,
          },
          after: {
            orderStatus: "CANCELLED",
            paymentStatus: "PAID",
            providerStatus: "PAID",
            reason:
              "RESERVATION_EXPIRED",
            requiresManualRefund: true,
            source: "WEBHOOK",
          },
        },
      });
    } else if (
      incomingStatus === "PAID" &&
      order.status === "PENDING_PAYMENT"
    ) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paymentStatus: "PAID",
          reservationExpiresAt: null,
        },
      });

      await inventory.commitOrder(tx, order.id);

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: "PENDING_PAYMENT",
          to: "PAID",
          note:
            "Pago confirmado mediante webhook verificado de Mercado Pago.",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_CONFIRMED",
          entityType: "Payment",
          entityId: current.id,
          before: {
            orderStatus: order.status,
            paymentStatus: currentStatus,
          },
          after: {
            orderId: order.id,
            provider: "MERCADOPAGO",
            status: "PAID",
            amountCents: current.amountCents,
            currency: current.currency,
            orderStatus: "PAID",
            paymentStatus: "PAID",
            source: "WEBHOOK",
          },
        },
      });

      paymentNotice = {
        orderCode: order.orderCode,
        comboQuantity: order.comboQuantity,
        totalCents: order.totalCents,
        currency: order.currency,
        locationLabel: order.pickupEvent.locationLabel,
        pickupEventId: order.pickupEvent.id,
      };
    } else if (latePaid) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_LATE_AFTER_ORDER_CLOSED",
          entityType: "Payment",
          entityId: current.id,
          before: {
            orderStatus: order.status,
            paymentStatus: order.paymentStatus,
            providerStatus: currentStatus,
          },
          after: {
            orderStatus: order.status,
            paymentStatus: "PAID",
            providerStatus: "PAID",
            requiresManualRefund: true,
            source: "WEBHOOK",
          },
        },
      });
    } else if (
      ["PENDING", "PROCESSING", "FAILED", "CANCELLED"].includes(
        incomingStatus,
      ) &&
      order.status === "PENDING_PAYMENT"
    ) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: incomingStatus,
        },
      });
    } else if (incomingStatus === "PARTIALLY_REFUNDED") {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PARTIALLY_REFUNDED",
        },
      });
    } else if (incomingStatus === "REFUNDED") {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "REFUNDED",
          ...(order.status === "CANCELLED"
            ? { status: "REFUNDED" }
            : {}),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "PAYMENT_WEBHOOK_APPLIED",
        entityType: "Payment",
        entityId: current.id,
        before: {
          status: currentStatus,
        },
        after: {
          status: incomingStatus,
          resourceId,
        },
      },
    });

    await tx.paymentWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "PROCESSED",
        processedAt: now,
      },
    });

    return {
      applied: true,
      paymentStatus: incomingStatus,
    };
  });

  if (paymentNotice) {
    telegram?.notifyPaymentConfirmed(paymentNotice);
    await groupTelegram?.observeCompleted(
      paymentNotice.pickupEventId,
    );
  }

  return result;
}
