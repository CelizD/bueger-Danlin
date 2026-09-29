import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";
import { processCustomerRefund } from "./customer-order-refund-processing.js";

function request() {
  return {
    paymentId: "payment-1",
    orderId: "order-1",
    orderCode: "H-A1B2C3D4",
    provider: "MERCADOPAGO" as const,
    externalId: "ORDTST01",
    amountCents: 13_000,
    metadata: {
      refundRequestedAt:
        "2026-09-28T00:00:00.000Z",
      refundStatus: "requested",
    },
  };
}

function harness() {
  const payment = {
    id: "payment-1",
    orderId: "order-1",
    provider: "MERCADOPAGO",
    status: "PAID",
    amountCents: 13_000,
    currency: "MXN",
    externalId: "ORDTST01",
    metadata: request().metadata,
  };

  const order = {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    status: "CANCELLED",
    paymentStatus: "PAID",
  };

  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { id: payment.id },
      ]),
    payment: {
      findUnique: vi
        .fn()
        .mockResolvedValue(payment),
      update: vi.fn(),
    },
    order: {
      findUnique: vi
        .fn()
        .mockResolvedValue(order),
      update: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (
        callback: (
          transaction: typeof tx,
        ) => unknown,
      ) => callback(tx),
    ),
    payment: {
      updateMany: vi.fn(),
    },
  } as unknown as PrismaService;

  const refund = vi
    .fn()
    .mockResolvedValue({
      externalId: "ORDTST01",
      status: "REFUNDED",
      refundedAmountCents: 13_000,
    });

  const registry = {
    get: vi.fn().mockReturnValue({
      refund,
    }),
  } as unknown as PaymentProviderRegistry;

  return {
    prisma,
    registry,
    refund,
    tx,
  };
}

describe("processCustomerRefund", () => {
  it("confirma el refund en Payment y Order solo después del proveedor", async () => {
    const {
      prisma,
      registry,
      refund,
      tx,
    } = harness();

    await expect(
      processCustomerRefund(
        prisma,
        registry,
        request(),
      ),
    ).resolves.toEqual({
      orderCode: "H-A1B2C3D4",
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      refundStatus: "REFUNDED",
    });

    expect(refund).toHaveBeenCalledWith({
      externalId: "ORDTST01",
      idempotencyKey:
        "customer-refund:payment-1",
    });

    expect(
      tx.payment.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "payment-1",
        },
        data: expect.objectContaining({
          status: "REFUNDED",
          refundedAt:
            expect.any(Date),
          metadata:
            expect.objectContaining({
              refundStatus:
                "completed",
              refundCompletedAt:
                expect.any(String),
            }),
        }),
      }),
    );

    expect(
      tx.order.update,
    ).toHaveBeenCalledWith({
      where: {
        id: "order-1",
      },
      data: {
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        reservationExpiresAt: null,
      },
    });
  });

  it("mantiene el refund pendiente y registra el intento si el proveedor falla", async () => {
    const {
      prisma,
      registry,
      refund,
    } = harness();

    refund.mockRejectedValueOnce(
      new Error(
        "Mercado Pago refund order failed (500: internal_error)",
      ),
    );

    await expect(
      processCustomerRefund(
        prisma,
        registry,
        request(),
      ),
    ).rejects.toThrow(
      "Mercado Pago refund order failed",
    );

    expect(
      prisma.payment.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "payment-1",
          status: {
            not: "REFUNDED",
          },
        },
        data: {
          metadata:
            expect.objectContaining({
              refundStatus:
                "requested",
              refundAttemptCount: 1,
              refundLastAttemptAt:
                expect.any(String),
              refundLastError:
                expect.stringContaining(
                  "internal_error",
                ),
            }),
        },
      }),
    );
  });
});
