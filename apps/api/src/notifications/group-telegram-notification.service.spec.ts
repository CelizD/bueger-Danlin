import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { TelegramNotificationService } from "./telegram-notification.service.js";
import { GroupTelegramNotificationService } from "./group-telegram-notification.service.js";

describe("GroupTelegramNotificationService", () => {
  it("marca una sola vez el hito 5/5 y envía el aviso", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "event-1" }]),
      pickupEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id: "event-1",
          freeDeliveryMinPaidCombos: 5,
          telegramGroupCompletedAt: null,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      order: {
        count: vi.fn().mockResolvedValue(5),
      },
    };

    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) =>
          callback(tx),
      ),
      pickupEvent: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "event-1",
          locationLabel: "Universidad",
          freeDeliveryMinPaidCombos: 5,
          telegramGroupCompletedPaidCombos: 5,
        }),
      },
    } as unknown as PrismaService;

    const telegram = {
      notifyGroupCompleted: vi.fn().mockResolvedValue(true),
      notifyGroupClosed: vi.fn().mockResolvedValue(false),
    } as unknown as TelegramNotificationService;

    const service = new GroupTelegramNotificationService(
      prisma,
      telegram,
    );

    await service.observeCompleted("event-1");

    expect(tx.pickupEvent.update).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: expect.objectContaining({
        telegramGroupCompletedAt: expect.any(Date),
        telegramGroupCompletedPaidCombos: 5,
      }),
    });
    expect(telegram.notifyGroupCompleted).toHaveBeenCalledWith({
      locationLabel: "Universidad",
      paidOrderCount: 5,
      minPaidCombos: 5,
    });
  });

  it("envía una sola vez el resumen de cierre del punto", async () => {
    const prisma = {
      pickupEvent: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "event-1",
          locationLabel: "Cucapá",
          freeDeliveryMinPaidCombos: 5,
          groupDeliveryFinalPaidCombos: 3,
          groupDeliveryFinalTransportCostCents: 10_000,
          groupDeliveryFinalAssignedCents: 10_000,
          groupDeliveryFinalFreeUnlocked: false,
          groupDeliveryFinalCancelledPendingOrders: 2,
        }),
      },
    } as unknown as PrismaService;

    const telegram = {
      notifyGroupCompleted: vi.fn().mockResolvedValue(false),
      notifyGroupClosed: vi.fn().mockResolvedValue(true),
    } as unknown as TelegramNotificationService;

    const service = new GroupTelegramNotificationService(
      prisma,
      telegram,
    );

    await service.flushEvent("event-1");

    expect(telegram.notifyGroupClosed).toHaveBeenCalledWith({
      locationLabel: "Cucapá",
      paidOrderCount: 3,
      minPaidCombos: 5,
      transportCostCents: 10_000,
      assignedCents: 10_000,
      freeDeliveryUnlocked: false,
      cancelledPendingOrders: 2,
    });
    expect(prisma.pickupEvent.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telegramGroupClosedNotifiedAt: expect.any(Date),
          telegramGroupClosedNotificationClaimedAt: null,
        }),
      }),
    );
  });

  it("libera el claim cuando Telegram falla para poder reintentar", async () => {
    const prisma = {
      pickupEvent: {
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: "event-1",
          locationLabel: "Universidad",
          freeDeliveryMinPaidCombos: 5,
          telegramGroupCompletedPaidCombos: 5,
        }),
      },
    } as unknown as PrismaService;

    const telegram = {
      notifyGroupCompleted: vi.fn().mockResolvedValue(false),
      notifyGroupClosed: vi.fn().mockResolvedValue(false),
    } as unknown as TelegramNotificationService;

    const service = new GroupTelegramNotificationService(
      prisma,
      telegram,
    );

    await service.flushEvent("event-1");

    expect(prisma.pickupEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          telegramGroupCompletedNotificationClaimedAt: null,
        },
      }),
    );
  });
});
