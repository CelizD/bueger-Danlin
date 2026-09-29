import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";

function metadataRecord(
  metadata: unknown,
): Record<string, unknown> {
  return metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function inputMetadata(
  metadata: unknown,
): Prisma.InputJsonObject {
  return {
    ...(metadataRecord(metadata) as Prisma.InputJsonObject),
  };
}

function requiresManualRefund(
  metadata: unknown,
) {
  return (
    metadataRecord(metadata)
      .requiresManualRefund === true
  );
}

function safeError(error: unknown) {
  return (
    error instanceof Error
      ? error.message
      : "refund provider call failed"
  )
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 180);
}

function providerName(
  provider: "MERCADOPAGO" | "STRIPE",
) {
  return provider === "MERCADOPAGO"
    ? ("mercadopago" as const)
    : ("stripe" as const);
}

export async function refundLatePaymentFromAdmin(
  prisma: PrismaService,
  providers: PaymentProviderRegistry,
  orderCodeInput: string,
  actorUserId: string,
) {
  const orderCode =
    orderCodeInput.trim().toUpperCase();

  const snapshot =
    await prisma.order.findUnique({
      where: { orderCode },
      include: {
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

  if (!snapshot) {
    throw new NotFoundException(
      "El pedido no existe.",
    );
  }

  const pendingPayment =
    snapshot.payments.find(
      (payment) =>
        payment.status === "PAID" &&
        requiresManualRefund(
          payment.metadata,
        ),
    );

  if (!pendingPayment) {
    const alreadyRefunded =
      snapshot.payments.some(
        (payment) =>
          payment.status ===
            "REFUNDED" &&
          metadataRecord(
            payment.metadata,
          ).latePaymentDetectedAt,
      );

    if (
      alreadyRefunded &&
      snapshot.status === "REFUNDED"
    ) {
      return {
        orderCode:
          snapshot.orderCode,
        status: "REFUNDED" as const,
        paymentStatus:
          "REFUNDED" as const,
        refundStatus:
          "REFUNDED" as const,
        alreadyRefunded: true,
      };
    }

    throw new ConflictException(
      "Este pedido no tiene un pago tardío pendiente de reembolso.",
    );
  }

  if (
    pendingPayment.provider !==
      "MERCADOPAGO" &&
    pendingPayment.provider !== "STRIPE"
  ) {
    throw new ConflictException(
      "El proveedor de este pago no admite reembolso real desde Admin.",
    );
  }

  if (!pendingPayment.externalId) {
    throw new ConflictException(
      "El pago no tiene una referencia externa válida para reembolso.",
    );
  }

  try {
    const provider = providers.get(
      providerName(
        pendingPayment.provider,
      ),
    );

    const refund = await provider.refund({
      externalId:
        pendingPayment.externalId,
      idempotencyKey:
        `admin-late-refund:${pendingPayment.id}`,
    });

    if (
      refund.status !== "REFUNDED"
    ) {
      throw new Error(
        `Refund provider returned ${refund.status}`,
      );
    }
  } catch (error) {
    const now = new Date();
    const previous =
      metadataRecord(
        pendingPayment.metadata,
      );
    const attempts =
      typeof previous
        .manualRefundAttemptCount ===
        "number"
        ? previous
            .manualRefundAttemptCount
        : 0;

    await prisma.payment.updateMany({
      where: {
        id: pendingPayment.id,
        status: "PAID",
      },
      data: {
        metadata: {
          ...inputMetadata(
            pendingPayment.metadata,
          ),
          requiresManualRefund: true,
          manualRefundStatus:
            "FAILED",
          manualRefundLastAttemptAt:
            now.toISOString(),
          manualRefundAttemptCount:
            attempts + 1,
          manualRefundLastError:
            safeError(error),
        },
      },
    });

    throw new BadGatewayException(
      "No se pudo completar el reembolso con el proveedor. El pago sigue marcado para reintento.",
    );
  }

  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const locked =
        await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT p."id"
          FROM "Payment" AS p
          INNER JOIN "Order" AS o
            ON o."id" = p."orderId"
          WHERE p."id" = ${pendingPayment.id}
          FOR UPDATE OF p, o
        `;

      if (locked.length === 0) {
        throw new NotFoundException(
          "El pago ya no existe.",
        );
      }

      const payment =
        await tx.payment.findUnique({
          where: {
            id: pendingPayment.id,
          },
        });
      const order =
        await tx.order.findUnique({
          where: {
            id: snapshot.id,
          },
        });

      if (!payment || !order) {
        throw new NotFoundException(
          "El pedido o el pago ya no existe.",
        );
      }

      if (
        payment.status ===
          "REFUNDED" &&
        order.status === "REFUNDED"
      ) {
        return {
          orderCode:
            order.orderCode,
          status: "REFUNDED" as const,
          paymentStatus:
            "REFUNDED" as const,
          refundStatus:
            "REFUNDED" as const,
          alreadyRefunded: true,
        };
      }

      if (
        payment.status !== "PAID" ||
        !requiresManualRefund(
          payment.metadata,
        )
      ) {
        throw new ConflictException(
          "El pago ya no está pendiente de reembolso manual.",
        );
      }

      const metadata = {
        ...inputMetadata(
          payment.metadata,
        ),
        requiresManualRefund: false,
        manualRefundStatus:
          "COMPLETED",
        manualRefundCompletedAt:
          now.toISOString(),
        manualRefundLastAttemptAt:
          now.toISOString(),
        manualRefundLastError: null,
      };

      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "REFUNDED",
          refundedAt: now,
          metadata,
        },
      });

      if (
        order.status !== "REFUNDED"
      ) {
        await tx.order.update({
          where: {
            id: order.id,
          },
          data: {
            status: "REFUNDED",
            paymentStatus:
              "REFUNDED",
            reservationExpiresAt:
              null,
          },
        });

        await tx.orderStatusHistory.create(
          {
            data: {
              orderId: order.id,
              from: order.status,
              to: "REFUNDED",
              note:
                "Reembolso de pago tardío confirmado manualmente por Admin.",
            },
          },
        );
      }

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action:
            "ADMIN_LATE_PAYMENT_REFUNDED",
          entityType: "Payment",
          entityId: payment.id,
          before: {
            orderStatus:
              order.status,
            paymentStatus:
              order.paymentStatus,
            providerStatus:
              payment.status,
            requiresManualRefund:
              true,
          },
          after: {
            orderId: order.id,
            orderCode:
              order.orderCode,
            orderStatus:
              "REFUNDED",
            paymentStatus:
              "REFUNDED",
            providerStatus:
              "REFUNDED",
            requiresManualRefund:
              false,
            amountCents:
              payment.amountCents,
            currency:
              payment.currency,
          },
        },
      });

      return {
        orderCode:
          order.orderCode,
        status: "REFUNDED" as const,
        paymentStatus:
          "REFUNDED" as const,
        refundStatus:
          "REFUNDED" as const,
        alreadyRefunded: false,
      };
    },
  );
}
