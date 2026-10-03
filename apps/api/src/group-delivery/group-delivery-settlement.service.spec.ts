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
      freeDeliveryMinPaidCombos: 5,
      transportCostCents: 10_000,
      groupDeliveryFinalizedAt: null,
      groupDeliveryFinalPaidCombos: null,
      groupDeliveryFinalFreeUnlocked: null,
      groupDeliveryFinalAssignedCents: null,
    };

    const pendingOrder = {
      id: "pending-1",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
    };

    const paidOrders = [
      {
        id: "paid-a",
        comboQuantity: 3,
        createdAt: new Date("2026-10-01T01:00:00Z"),
      },
      {
        id: "paid-b",
        comboQuantity: 2,
        createdAt: new Date("2026-10-01T02:00:00Z"),
      },
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
      paidOrderCount: 2,
      paidComboCount: 5,
      freeDeliveryUnlocked: true,
      assignedCents: 0,
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
    ).toEqual([0, 0]);

    expect(tx.pickupEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        status: "CLOSED",
        groupDeliveryFinalPaidCombos: 5,
        groupDeliveryFinalAssignedCents: 0,
        groupDeliveryFinalFreeUnlocked: true,
        groupDeliveryFinalCancelledPendingOrders: 1,
      }),
    });
    expect(groupTelegram.flushEvent).toHaveBeenCalledWith(
      "event-1",
    );
  });

  it("reparte el transporte entre pedidos pagados cuando no se alcanza la meta", async () => {
    const now = new Date("2026-10-03T04:00:00.000Z");

    const event = {
      id: "event-paid-four",
      status: "OPEN",
      closesAt: new Date("2026-10-03T03:59:00.000Z"),
      freeDeliveryMinPaidCombos: 5,
      transportCostCents: 10_000,
      groupDeliveryFinalizedAt: null,
      groupDeliveryFinalPaidCombos: null,
      groupDeliveryFinalFreeUnlocked: null,
      groupDeliveryFinalAssignedCents: null,
    };

    const paidOrders = [
      {
        id: "paid-a",
        comboQuantity: 1,
        createdAt: new Date("2026-10-01T01:00:00Z"),
      },
      {
        id: "paid-b",
        comboQuantity: 1,
        createdAt: new Date("2026-10-01T02:00:00Z"),
      },
      {
        id: "paid-c",
        comboQuantity: 1,
        createdAt: new Date("2026-10-01T03:00:00Z"),
      },
      {
        id: "paid-d",
        comboQuantity: 1,
        createdAt: new Date("2026-10-01T04:00:00Z"),
      },
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
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(paidOrders),
        updateMany: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
      },
      payment: {
        updateMany: vi.fn(),
      },
      orderStatusHistory: {
        create: vi.fn(),
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
      releaseOrder: vi.fn(),
    } as unknown as InventoryService;

    const service = new GroupDeliverySettlementService(
      prisma,
      inventory,
    );

    const result = await service.settleEvent(event.id, {
      now,
      reason: "cutoff",
    });

    expect(result).toMatchObject({
      settled: true,
      paidOrderCount: 4,
      paidComboCount: 4,
      freeDeliveryUnlocked: false,
      transportCostCents: 10_000,
      assignedCents: 10_000,
      cancelledPendingOrders: 0,
    });

    const paidUpdates = tx.order.update.mock.calls.map(
      ([call]) => call,
    );

    expect(
      paidUpdates.map(
        (call) => call.data.groupDeliveryFinalFeeCents,
      ),
    ).toEqual([2_500, 2_500, 2_500, 2_500]);

    expect(tx.pickupEvent.update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: expect.objectContaining({
        status: "CLOSED",
        groupDeliveryFinalPaidCombos: 4,
        groupDeliveryFinalAssignedCents: 10_000,
        groupDeliveryFinalFreeUnlocked: false,
      }),
    });
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
          groupDeliveryFinalPaidCombos: 4,
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
      paidComboCount: 4,
      assignedCents: 10_000,
    });
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });
});
