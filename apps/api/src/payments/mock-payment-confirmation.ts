import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import type { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import type { PurchaseEmailService } from "../notifications/purchase-email.service.js";
import { queuePurchaseConfirmationEmail } from "../notifications/purchase-email-outbox.js";
import { assertOrderVerificationToken } from "../orders/customer-order-security.js";
import type { PaymentProviderRegistry } from "./payment-provider.registry.js";
export async function confirmMockOrderPayment(
  prisma: PrismaService,
  inventory: InventoryService,
  paymentProviderRegistry: PaymentProviderRegistry,
  telegram: TelegramNotificationService | undefined,
  groupTelegram: GroupTelegramNotificationService | undefined,
  purchaseEmail: PurchaseEmailService | undefined,
  orderCode: string,
  verificationToken: string,
) {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException();
    }

    const orderSnapshot = await prisma.order.findUnique({
      where: { orderCode },
    });

    if (!orderSnapshot) {
      throw new NotFoundException("El pedido no existe.");
    }

    assertOrderVerificationToken(
      orderSnapshot.verificationTokenHash,
      verificationToken,
    );

    let paymentNotice:
      | {
          orderCode: string;
          comboQuantity: number;
          totalCents: number;
          currency: string;
          locationLabel?: string;
          pickupEventId: string;
          orderId: string;
        }
      | undefined;

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "orderCode" = ${orderCode}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException("El pedido no existe.");
      }

      const order = await tx.order.findUnique({
        where: { orderCode },
        include: {
          pickupEvent: true,
          customer: true,
        },
      });

      if (!order) {
        throw new NotFoundException("El pedido no existe.");
      }

      assertOrderVerificationToken(
        order.verificationTokenHash,
        verificationToken,
      );

      if (order.paymentStatus === "PAID") {
        return {
          orderCode: order.orderCode,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalCents: order.totalCents,
          currency: order.currency,
          paid: true,
        };
      }

      if (order.status !== "PENDING_PAYMENT") {
        throw new ConflictException(
          "Este pedido ya no está disponible para pago.",
        );
      }

      const now = new Date();

      if (
        order.pickupEvent.groupDeliveryFinalizedAt ||
        !["OPEN", "SOLD_OUT"].includes(order.pickupEvent.status) ||
        now >= order.pickupEvent.closesAt
      ) {
        throw new ConflictException(
          "El punto de entrega ya cerró y este pedido ya no puede pagarse.",
        );
      }

      if (
        !order.reservationExpiresAt ||
        order.reservationExpiresAt <= now
      ) {
        throw new ConflictException(
          "La reserva de 15 minutos expiró. Crea un pedido nuevo.",
        );
      }

      const idempotencyKey = `mock:${order.id}`;
      const mockPaymentProvider =
        paymentProviderRegistry.get("mock");
      const providerPayment =
        await mockPaymentProvider.createCheckout({
          paymentId: order.id,
          orderCode: order.orderCode,
          amountCents: order.totalCents,
          currency: order.currency,
          description: `Pedido ${order.orderCode} - Burger Danlin`,
          idempotencyKey,
          expiresAt: order.reservationExpiresAt,
          customer: {
            name: order.customer.name,
            email: order.customer.email,
            phone: order.customer.phone,
          },
        });

      if (providerPayment.status !== "PAID") {
        throw new ConflictException(
          "El pago simulado no fue aprobado.",
        );
      }

      const confirmedPayment = await tx.payment.upsert({
        where: { idempotencyKey },
        update: {
          status: "PAID",
          amountCents: order.totalCents,
          paidAt: now,
        },
        create: {
          orderId: order.id,
          provider: "MOCK",
          status: "PAID",
          amountCents: order.totalCents,
          currency: order.currency,
          externalId: providerPayment.externalId,
          idempotencyKey,
          paidAt: now,
          metadata: {
            environment: "local",
          },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_CONFIRMED",
          entityType: "Payment",
          entityId: confirmedPayment.id,
          before: {
            orderStatus: order.status,
            paymentStatus: order.paymentStatus,
          },
          after: {
            orderId: order.id,
            provider: confirmedPayment.provider,
            status: confirmedPayment.status,
            amountCents: confirmedPayment.amountCents,
            currency: confirmedPayment.currency,
            orderStatus: "PAID",
            paymentStatus: "PAID",
          },
        },
      });

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
          note: "Pago local simulado confirmado.",
        },
      });

      await queuePurchaseConfirmationEmail(
        tx,
        {
          orderId: order.id,
          email: order.customer.email,
        },
      );

      paymentNotice = {
        orderCode: order.orderCode,
        comboQuantity: order.comboQuantity,
        totalCents: order.totalCents,
        currency: order.currency,
        locationLabel: order.pickupEvent.locationLabel,
        pickupEventId: order.pickupEvent.id,
        orderId: order.id,
      };

      return {
        orderCode: order.orderCode,
        status: "PAID",
        paymentStatus: "PAID",
        totalCents: order.totalCents,
        currency: order.currency,
        paid: true,
      };
    });

    if (paymentNotice) {
      telegram?.notifyPaymentConfirmed(paymentNotice);

      void purchaseEmail
        ?.trySendForOrder(
          paymentNotice.orderId,
        )
        .catch(() => undefined);
      await groupTelegram?.observeCompleted(
        paymentNotice.pickupEventId,
      );
    }

    return result;
}
