import type { PrismaService } from "../database/prisma.service.js";
import type { PaymentProviderName } from "../payments/domain/payment-provider.types.js";
import type { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";
import {
  withRefundFailureMetadata,
  withRefundMetadata,
} from "./customer-order-refund.js";

export type CustomerRefundRequest = {
  paymentId: string;
  orderId: string;
  orderCode: string;
  provider: "MERCADOPAGO" | "STRIPE";
  externalId: string;
  amountCents: number;
  metadata: unknown;
};

function providerName(
  provider: CustomerRefundRequest["provider"],
): PaymentProviderName {
  switch (provider) {
    case "MERCADOPAGO":
      return "mercadopago";
    case "STRIPE":
      return "stripe";
  }
}

export async function processCustomerRefund(
  prisma: PrismaService,
  registry: PaymentProviderRegistry,
  request: CustomerRefundRequest,
) {
  const provider = registry.get(
    providerName(request.provider),
  );

  try {
    const refund = await provider.refund({
      externalId: request.externalId,
      idempotencyKey:
        `customer-refund:${request.paymentId}`,
    });

    if (refund.status !== "REFUNDED") {
      throw new Error(
        `Refund provider returned ${refund.status}`,
      );
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const locked =
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Payment"
          WHERE "id" = ${request.paymentId}
          FOR UPDATE
        `;

      if (locked.length === 0) {
        throw new Error(
          "Payment disappeared while finalizing refund",
        );
      }

      const payment =
        await tx.payment.findUnique({
          where: {
            id: request.paymentId,
          },
        });

      if (!payment) {
        throw new Error(
          "Payment disappeared while finalizing refund",
        );
      }

      if (payment.status === "REFUNDED") {
        return;
      }

      const order =
        await tx.order.findUnique({
          where: {
            id: request.orderId,
          },
        });

      if (!order) {
        throw new Error(
          "Order disappeared while finalizing refund",
        );
      }

      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "REFUNDED",
          refundedAt: now,
          metadata: withRefundMetadata(
            payment.metadata,
            now,
            "completed",
          ),
        },
      });

      if (order.status !== "REFUNDED") {
        await tx.order.update({
          where: {
            id: order.id,
          },
          data: {
            status: "REFUNDED",
            paymentStatus: "REFUNDED",
            reservationExpiresAt: null,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: order.status,
            to: "REFUNDED",
            note:
              "Reembolso confirmado por el proveedor de pago.",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "CUSTOMER_ORDER_REFUNDED",
            entityType: "Order",
            entityId: order.id,
            before: {
              status: order.status,
              paymentStatus:
                order.paymentStatus,
            },
            after: {
              status: "REFUNDED",
              paymentStatus: "REFUNDED",
              provider:
                request.provider,
              externalId:
                request.externalId,
            },
          },
        });
      }
    });

    return {
      orderCode: request.orderCode,
      status: "REFUNDED" as const,
      paymentStatus: "REFUNDED" as const,
      refundStatus: "REFUNDED" as const,
    };
  } catch (error) {
    const now = new Date();

    await prisma.payment.updateMany({
      where: {
        id: request.paymentId,
        status: {
          not: "REFUNDED",
        },
      },
      data: {
        metadata: withRefundFailureMetadata(
          request.metadata,
          now,
          error,
        ),
      },
    });

    throw error;
  }
}
