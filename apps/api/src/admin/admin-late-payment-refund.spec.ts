import {
  BadGatewayException,
} from "@nestjs/common";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";
import { refundLatePaymentFromAdmin } from "./admin-late-payment-refund.js";

function harness(
  refundFails = false,
) {
  const metadata = {
    latePaymentDetectedAt:
      "2026-09-29T19:00:00.000Z",
    latePaymentReason:
      "RESERVATION_EXPIRED",
    requiresManualRefund: true,
  };

  const payment = {
    id: "payment-1",
    orderId: "order-1",
    provider:
      "MERCADOPAGO" as const,
    status: "PAID" as const,
    amountCents: 13_000,
    currency: "MXN",
    externalId: "MP-ORDER-1",
    metadata,
    createdAt: new Date(),
  };

  const order = {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    status: "CANCELLED" as const,
    paymentStatus: "PAID" as const,
  };

  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { id: "payment-1" },
      ]),
    payment: {
      findUnique: vi
        .fn()
        .mockResolvedValue(payment),
      update: vi
        .fn()
        .mockResolvedValue(undefined),
    },
    order: {
      findUnique: vi
        .fn()
        .mockResolvedValue(order),
      update: vi
        .fn()
        .mockResolvedValue(undefined),
    },
    orderStatusHistory: {
      create: vi
        .fn()
        .mockResolvedValue(undefined),
    },
    auditLog: {
      create: vi
        .fn()
        .mockResolvedValue(undefined),
    },
  };

  const prisma = {
    order: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          ...order,
          payments: [payment],
        }),
    },
    payment: {
      updateMany: vi
        .fn()
        .mockResolvedValue({
          count: 1,
        }),
    },
    $transaction: vi.fn(
      async (
        callback: (
          transaction: typeof tx,
        ) => unknown,
      ) => callback(tx),
    ),
  } as unknown as PrismaService;

  const refund = vi.fn();

  if (refundFails) {
    refund.mockRejectedValue(
      new Error("provider unavailable"),
    );
  } else {
    refund.mockResolvedValue({
      externalId: "MP-ORDER-1",
      status: "REFUNDED",
      refundedAmountCents:
        13_000,
    });
  }

  const providers = {
    get: vi
      .fn()
      .mockReturnValue({
        refund,
      }),
  } as unknown as PaymentProviderRegistry;

  return {
    prisma,
    providers,
    refund,
    tx,
  };
}

describe(
  "refundLatePaymentFromAdmin",
  () => {
    it("reembolsa el pago tardío y audita al administrador", async () => {
      const h = harness();

      const result =
        await refundLatePaymentFromAdmin(
          h.prisma,
          h.providers,
          "H-A1B2C3D4",
          "admin-1",
        );

      expect(
        h.refund,
      ).toHaveBeenCalledWith({
        externalId: "MP-ORDER-1",
        idempotencyKey:
          "admin-late-refund:payment-1",
      });

      expect(
        h.tx.payment.update,
      ).toHaveBeenCalledWith({
        where: {
          id: "payment-1",
        },
        data: expect.objectContaining({
          status: "REFUNDED",
          refundedAt:
            expect.any(Date),
          metadata:
            expect.objectContaining({
              requiresManualRefund:
                false,
              manualRefundStatus:
                "COMPLETED",
            }),
        }),
      });

      expect(
        h.tx.order.update,
      ).toHaveBeenCalledWith({
        where: {
          id: "order-1",
        },
        data: {
          status: "REFUNDED",
          paymentStatus:
            "REFUNDED",
          reservationExpiresAt:
            null,
        },
      });

      expect(
        h.tx.auditLog.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "admin-1",
          action:
            "ADMIN_LATE_PAYMENT_REFUNDED",
          entityType: "Payment",
          entityId: "payment-1",
        }),
      });

      expect(result).toMatchObject({
        orderCode:
          "H-A1B2C3D4",
        status: "REFUNDED",
        paymentStatus:
          "REFUNDED",
        refundStatus:
          "REFUNDED",
        alreadyRefunded: false,
      });
    });

    it("conserva el pendiente para reintento si falla el proveedor", async () => {
      const h = harness(true);

      await expect(
        refundLatePaymentFromAdmin(
          h.prisma,
          h.providers,
          "H-A1B2C3D4",
          "admin-1",
        ),
      ).rejects.toBeInstanceOf(
        BadGatewayException,
      );

      expect(
        h.prisma.payment
          .updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: "payment-1",
          status: "PAID",
        },
        data: {
          metadata:
            expect.objectContaining({
              requiresManualRefund:
                true,
              manualRefundStatus:
                "FAILED",
              manualRefundAttemptCount:
                1,
            }),
        },
      });

      expect(
        h.tx.order.update,
      ).not.toHaveBeenCalled();
    });
  },
);
