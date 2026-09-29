import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import { assertOrderVerificationToken } from "../orders/customer-order-security.js";
import type { PaymentProviderName } from "./domain/payment-provider.types.js";
import type { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { assertRealPaymentsEnabled } from "./real-payments.guard.js";
function databaseProvider(name: PaymentProviderName) {
  switch (name) {
    case "mercadopago":
      return "MERCADOPAGO" as const;
    case "stripe":
      return "STRIPE" as const;
    default:
      throw new Error(
        "The mock provider cannot create a real checkout",
      );
  }
}

function checkoutReturnUrls(orderCode: string) {
  const configuredOrigin = process.env.APP_ORIGIN
    ?.split(",")
    .map((origin) => origin.trim())
    .find(Boolean);

  if (!configuredOrigin) {
    return undefined;
  }

  let origin: string;

  try {
    origin = new URL(configuredOrigin).origin;
  } catch {
    return undefined;
  }

  const orderPath =
    `${origin}/pedido/${encodeURIComponent(orderCode)}`;

  return {
    successUrl: `${orderPath}?payment=success`,
    failureUrl: `${orderPath}?payment=failure`,
    pendingUrl: `${orderPath}?payment=pending`,
  };
}

function checkoutUrlFromMetadata(metadata: unknown) {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return undefined;
  }

  const checkoutUrl = (metadata as Record<string, unknown>)
    .checkoutUrl;

  return typeof checkoutUrl === "string" && checkoutUrl.length > 0
    ? checkoutUrl
    : undefined;
}

export async function createPaymentCheckout(
  prisma: PrismaService,
  paymentProviderRegistry: PaymentProviderRegistry,
  orderCode: string,
  verificationToken: string,
) {
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

    const provider = paymentProviderRegistry.getConfigured();

    if (provider.name === "mock") {
      throw new ConflictException(
        "El checkout real no está disponible con el proveedor mock.",
      );
    }

    assertRealPaymentsEnabled();

    const providerForDatabase = databaseProvider(provider.name);

    const prepared = await prisma.$transaction(async (tx) => {
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
          customer: true,
          pickupEvent: true,
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
        throw new ConflictException(
          "Este pedido ya fue pagado.",
        );
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

      const idempotencyKey = `${provider.name}:${order.id}`;
      let payment = await tx.payment.findUnique({
        where: { idempotencyKey },
      });

      if (!payment) {
        payment = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: providerForDatabase,
            status: "PENDING",
            amountCents: order.totalCents,
            currency: order.currency,
            idempotencyKey,
            metadata: {
              checkoutState: "PENDING",
            },
          },
        });

        await tx.auditLog.create({
          data: {
            action: "PAYMENT_CHECKOUT_CREATED",
            entityType: "Payment",
            entityId: payment.id,
            after: {
              orderId: order.id,
              provider: providerForDatabase,
              status: payment.status,
              amountCents: payment.amountCents,
              currency: payment.currency,
            },
          },
        });
      }

      if (
        payment.orderId !== order.id ||
        payment.provider !== providerForDatabase ||
        payment.amountCents !== order.totalCents ||
        payment.currency !== order.currency
      ) {
        throw new ConflictException(
          "El intento de pago no coincide con el pedido.",
        );
      }

      if (payment.status === "PAID") {
        throw new ConflictException(
          "El pago ya fue aprobado y está esperando confirmación.",
        );
      }

      if (
        payment.status !== "PENDING" &&
        payment.status !== "PROCESSING"
      ) {
        throw new ConflictException(
          "El intento de pago ya no está disponible.",
        );
      }

      return {
        order: {
          id: order.id,
          orderCode: order.orderCode,
          totalCents: order.totalCents,
          currency: order.currency,
          reservationExpiresAt: order.reservationExpiresAt,
          customer: order.customer,
        },
        payment,
        idempotencyKey,
        checkoutUrl: checkoutUrlFromMetadata(payment.metadata),
      };
    });

    if (
      prepared.payment.externalId &&
      prepared.checkoutUrl
    ) {
      return {
        orderCode: prepared.order.orderCode,
        orderStatus: "PENDING_PAYMENT",
        paymentId: prepared.payment.id,
        paymentStatus: prepared.payment.status,
        provider: provider.name,
        checkoutUrl: prepared.checkoutUrl,
        expiresAt: prepared.order.reservationExpiresAt,
      };
    }

    const providerCheckout = await provider.createCheckout({
      paymentId: prepared.payment.id,
      orderCode: prepared.order.orderCode,
      amountCents: prepared.order.totalCents,
      currency: prepared.order.currency,
      description:
        `Pedido ${prepared.order.orderCode} - Burger Danlin`,
      idempotencyKey: prepared.idempotencyKey,
      expiresAt: prepared.order.reservationExpiresAt,
      customer: {
        name: prepared.order.customer.name,
        email: prepared.order.customer.email,
        phone: prepared.order.customer.phone,
      },
      returnUrls: checkoutReturnUrls(
        prepared.order.orderCode,
      ),
    });

    if (!providerCheckout.checkoutUrl) {
      throw new ConflictException(
        "El proveedor de pago no devolvió una URL de checkout.",
      );
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: prepared.payment.id },
      data: {
        externalId: providerCheckout.externalId,
        status: providerCheckout.status,
        metadata: {
          checkoutState: "CREATED",
          checkoutUrl: providerCheckout.checkoutUrl,
        },
      },
    });

    return {
      orderCode: prepared.order.orderCode,
      orderStatus: "PENDING_PAYMENT",
      paymentId: updatedPayment.id,
      paymentStatus: updatedPayment.status,
      provider: provider.name,
      checkoutUrl: providerCheckout.checkoutUrl,
      expiresAt: prepared.order.reservationExpiresAt,
    };
}
