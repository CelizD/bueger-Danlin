import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  ANONYMIZED_CUSTOMER,
  RetentionCleanupService,
  eligibleOrderWhere,
  retentionCutoffs,
} from "./retention-cleanup.service.js";

const NOW = new Date("2026-09-27T18:00:00.000Z");

function harness() {
  const customerCount = vi
    .fn()
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(1);
  const auditCount = vi
    .fn()
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(2);
  const orderCount = vi.fn().mockResolvedValue(1);

  const customerUpdate = vi.fn().mockResolvedValue(undefined);
  const paymentUpdateMany = vi
    .fn()
    .mockResolvedValue({ count: 2 });

  const tx = {
    customer: { update: customerUpdate },
    payment: { updateMany: paymentUpdateMany },
  };

  const prisma = {
    customer: {
      count: customerCount,
      findMany: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: "customer-1",
            orders: [
              { id: "order-1" },
              { id: "order-2" },
            ],
          },
        ])
        .mockResolvedValueOnce([]),
      deleteMany: vi
        .fn()
        .mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      count: auditCount,
      deleteMany: vi
        .fn()
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 4 }),
    },
    order: {
      count: orderCount,
    },
    $transaction: vi.fn(
      async (
        callback: (client: typeof tx) => Promise<number>,
      ) => callback(tx),
    ),
  };

  return {
    service: new RetentionCleanupService(
      prisma as unknown as PrismaClient,
    ),
    prisma,
    tx,
  };
}

describe("retention policy", () => {
  it("calcula los cortes desde una fecha estable", () => {
    expect(retentionCutoffs(NOW)).toMatchObject({
      pendingPayment: new Date(
        "2026-08-28T18:00:00.000Z",
      ),
      cancelled: new Date(
        "2026-06-29T18:00:00.000Z",
      ),
      historical: new Date(
        "2025-09-27T18:00:00.000Z",
      ),
    });
  });

  it("solo considera estados previstos por la política", () => {
    const where = eligibleOrderWhere(NOW);

    expect(where).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({
            status: "PENDING_PAYMENT",
          }),
          expect.objectContaining({
            status: "CANCELLED",
            paymentStatus: {
              in: ["PENDING", "FAILED", "CANCELLED"],
            },
          }),
          expect.objectContaining({
            status: "CANCELLED",
            paymentStatus: {
              in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"],
            },
          }),
          expect.objectContaining({
            status: {
              in: [
                "DELIVERED",
                "REFUNDED",
                "NO_SHOW",
              ],
            },
          }),
        ]),
      }),
    );
  });

  it("dry-run no modifica datos", async () => {
    const { service, prisma } = harness();

    const report = await service.inspect({ now: NOW });

    expect(report.mode).toBe("dry-run");
    expect(report.candidates).toEqual({
      customersToAnonymize: 2,
      orphanCustomersToDelete: 1,
      auditLogsToDelete: 6,
      staleOperationalOrders: 1,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      prisma.customer.deleteMany,
    ).not.toHaveBeenCalled();
    expect(
      prisma.auditLog.deleteMany,
    ).not.toHaveBeenCalled();
  });

  it("apply anonimiza PII, limpia metadata y purga datos vencidos", async () => {
    const { service, prisma, tx } = harness();

    const report = await service.run({
      now: NOW,
      batchSize: 25,
    });

    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      data: ANONYMIZED_CUSTOMER,
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: {
          in: ["order-1", "order-2"],
        },
      },
      data: { metadata: {} },
    });
    expect(
      prisma.customer.deleteMany,
    ).toHaveBeenCalledTimes(1);
    expect(
      prisma.auditLog.deleteMany,
    ).toHaveBeenCalledTimes(2);
    expect(report.result).toEqual({
      customersAnonymized: 1,
      paymentMetadataCleared: 2,
      orphanCustomersDeleted: 1,
      auditLogsDeleted: 6,
      staleOperationalOrders: 1,
    });
  });
});
