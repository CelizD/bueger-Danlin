import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import {
  allocateTransportCost,
  GroupDeliverySettlementService,
} from "./group-delivery-settlement.service.js";

describe("allocateTransportCost", () => {
  it("reparte exactamente el total incluyendo centavos sobrantes", () => {
    const result = allocateTransportCost(
      ["order-a", "order-b", "order-c"],
      10_000,
      false,
    );

    expect([...result.values()]).toEqual([
      3_334,
      3_333,
      3_333,
    ]);
    expect(
      [...result.values()].reduce((sum, value) => sum + value, 0),
    ).toBe(10_000);
  });

  it("asigna cero cuando la meta de envío gratis se alcanzó", () => {
    const result = allocateTransportCost(
      ["order-a", "order-b", "order-c", "order-d", "order-e"],
      10_000,
      true,
    );

    expect([...result.values()]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("GroupDeliverySettlementService", () => {
  it("cierra, cancela pendientes y congela cargos finales", async () => {
    const now = new Date("2026-10-03T04:00:00.000Z");

    const event = {
      id: "event-1",
      status: "OPEN",
      closesAt: new Date("2026-10-03T03:59:00.000Z"),
      freeDeliveryMinPaidOrders: 5,
      transportCostCents: 10_000,
      groupDeliveryFinalizedAt: null,
      groupDeliveryFinalPaidOrders: null,
      groupDeliveryFinalFreeUnlocked: null,
      groupDeliveryFinalAssignedCents: null,
    };

    const pendingOrder = {
      id: "pending-1",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
    };

    const paidOrders = [
      { id: "paid-a", createdAt: new Date("2026-10-01T01:00:00Z") },
      { id: "paid-b", createdAt: new Date("2026-10-01T02:00:00Z") },
      { id: "paid-c", createdAt: new Date("2026-10-01T03:00:00Z") },
    ];

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: event.id }]),
      pickupEvent: {
        findUnique: vi.fn().mockResolvedValue(event),
        update: vi.fn().mockImplementation(({ data }) => ({
          ...event,
          ...data,
        })),
      },
      order: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([pendingOrder])
          .mockResolvedValueOnce(paidOrders),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: {
        create: vi.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue(undefined),
      },
    };

    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const inventory = {
      releaseOrder: vi.fn().mockResolvedValue(undefined),
    } as unknown as InventoryService;

    const groupTelegram = {
      flushEvent: vi.fn().mockResolvedValue(undefined),
      flushPending: vi.fn().mockResolvedValue(undefined),
    } as unknown as GroupTelegramNotificationService;

    const service = new GroupDeliverySettlementService(
      prisma,
      inventory,
      groupTelegram,
    );

    const result = await service.settleEvent("event-1", {
      now,
      reason: "cutoff",
    });

    expect(result).toMatchObject({
      settled: true,
      paidOrderCount: 3,
      freeDeliveryUnlocked: false,
      assignedCents: 10_000,
      cancelledPendingOrders: 1,
    });

    expect(inventory.releaseOrder).toHaveBeenCalledWith(
      tx,
      "pending-1",
    );

    const paidUpdates = tx.order.update.mock.calls
      .map(([call]) => call)
      .filter((call) => call.data.groupDeliveryFinalFeeCents != null);

    expect(
      paidUpdates.map((call) => call.data.groupDeliveryFinalFeeCents),
    ).toEqual([3_334, 3_333, 3_333]);

    expect(tx.pickupEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        status: "CLOSED",
        groupDeliveryFinalPaidOrders: 3,
        groupDeliveryFinalAssignedCents: 10_000,
        groupDeliveryFinalFreeUnlocked: false,
        groupDeliveryFinalCancelledPendingOrders: 1,
      }),
    });
    expect(groupTelegram.flushEvent).toHaveBeenCalledWith(
      "event-1",
    );
  });

  it("no recalcula un grupo ya finalizado", async () => {
    const finalizedAt = new Date();

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "event-1" }]),
      pickupEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id: "event-1",
          status: "CLOSED",
          groupDeliveryFinalizedAt: finalizedAt,
          groupDeliveryFinalPaidOrders: 4,
          groupDeliveryFinalFreeUnlocked: false,
          groupDeliveryFinalAssignedCents: 10_000,
        }),
      },
      order: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        updateMany: vi.fn(),
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
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
    } as unknown as PrismaService;

    const inventory = {
      releaseOrder: vi.fn(),
    } as unknown as InventoryService;

    const service = new GroupDeliverySettlementService(
      prisma,
      inventory,
    );

    const result = await service.settleEvent("event-1");

    expect(result).toMatchObject({
      settled: false,
      alreadyFinalized: true,
      paidOrderCount: 4,
      assignedCents: 10_000,
    });
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });
});
