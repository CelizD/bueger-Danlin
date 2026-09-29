import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { TelegramNotificationService } from "./telegram-notification.service.js";

const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class GroupTelegramNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotificationService,
  ) {}

  async observeCompleted(eventId: string) {
    const reached = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "PickupEvent"
        WHERE "id" = ${eventId}
        FOR UPDATE
      `;

      if (locked.length === 0) return false;

      const event = await tx.pickupEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          freeDeliveryMinPaidCombos: true,
          telegramGroupCompletedAt: true,
        },
      });

      if (!event) return false;

      const paidOrderCount = await tx.order.count({
        where: {
          pickupEventId: eventId,
          paymentStatus: "PAID",
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
        },
      });

      if (
        paidOrderCount < event.freeDeliveryMinPaidCombos
      ) {
        return false;
      }

      if (!event.telegramGroupCompletedAt) {
        await tx.pickupEvent.update({
          where: { id: eventId },
          data: {
            telegramGroupCompletedAt: new Date(),
            telegramGroupCompletedPaidCombos: paidOrderCount,
          },
        });
      }

      return true;
    });

    if (reached) {
      await this.flushEvent(eventId);
    }
  }

  async flushPending(limit = 50) {
    const pending = await this.prisma.pickupEvent.findMany({
      where: {
        OR: [
          {
            telegramGroupCompletedAt: { not: null },
            telegramGroupCompletedNotifiedAt: null,
          },
          {
            groupDeliveryFinalizedAt: { not: null },
            telegramGroupClosedNotifiedAt: null,
          },
        ],
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });

    for (const event of pending) {
      await this.flushEvent(event.id);
    }

    return {
      checked: pending.length,
    };
  }

  async flushEvent(eventId: string) {
    await this.flushCompleted(eventId);
    await this.flushClosed(eventId);
  }

  private async flushCompleted(eventId: string) {
    const claimAt = new Date();
    const staleBefore = new Date(
      claimAt.getTime() - CLAIM_TIMEOUT_MS,
    );

    const claimed = await this.prisma.pickupEvent.updateMany({
      where: {
        id: eventId,
        telegramGroupCompletedAt: { not: null },
        telegramGroupCompletedNotifiedAt: null,
        OR: [
          {
            telegramGroupCompletedNotificationClaimedAt: null,
          },
          {
            telegramGroupCompletedNotificationClaimedAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      data: {
        telegramGroupCompletedNotificationClaimedAt:
          claimAt,
      },
    });

    if (claimed.count !== 1) return;

    const event = await this.prisma.pickupEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        locationLabel: true,
        freeDeliveryMinPaidCombos: true,
        telegramGroupCompletedPaidCombos: true,
      },
    });

    if (!event) {
      await this.releaseCompletedClaim(eventId, claimAt);
      return;
    }

    const sent = await this.telegram.notifyGroupCompleted({
      locationLabel: event.locationLabel,
      paidOrderCount:
        event.telegramGroupCompletedPaidCombos ??
        event.freeDeliveryMinPaidCombos,
      minPaidOrders: event.freeDeliveryMinPaidCombos,
    });

    if (!sent) {
      await this.releaseCompletedClaim(eventId, claimAt);
      return;
    }

    await this.prisma.pickupEvent.updateMany({
      where: {
        id: eventId,
        telegramGroupCompletedNotifiedAt: null,
        telegramGroupCompletedNotificationClaimedAt:
          claimAt,
      },
      data: {
        telegramGroupCompletedNotifiedAt: new Date(),
        telegramGroupCompletedNotificationClaimedAt: null,
      },
    });
  }

  private async flushClosed(eventId: string) {
    const claimAt = new Date();
    const staleBefore = new Date(
      claimAt.getTime() - CLAIM_TIMEOUT_MS,
    );

    const claimed = await this.prisma.pickupEvent.updateMany({
      where: {
        id: eventId,
        groupDeliveryFinalizedAt: { not: null },
        telegramGroupClosedNotifiedAt: null,
        OR: [
          {
            telegramGroupClosedNotificationClaimedAt: null,
          },
          {
            telegramGroupClosedNotificationClaimedAt: {
              lt: staleBefore,
            },
          },
        ],
      },
      data: {
        telegramGroupClosedNotificationClaimedAt:
          claimAt,
      },
    });

    if (claimed.count !== 1) return;

    const event = await this.prisma.pickupEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        locationLabel: true,
        freeDeliveryMinPaidCombos: true,
        groupDeliveryFinalPaidCombos: true,
        groupDeliveryFinalTransportCostCents: true,
        groupDeliveryFinalAssignedCents: true,
        groupDeliveryFinalFreeUnlocked: true,
        groupDeliveryFinalCancelledPendingOrders: true,
      },
    });

    if (!event) {
      await this.releaseClosedClaim(eventId, claimAt);
      return;
    }

    const sent = await this.telegram.notifyGroupClosed({
      locationLabel: event.locationLabel,
      paidOrderCount:
        event.groupDeliveryFinalPaidCombos ?? 0,
      minPaidOrders: event.freeDeliveryMinPaidCombos,
      transportCostCents:
        event.groupDeliveryFinalTransportCostCents ?? 0,
      assignedCents:
        event.groupDeliveryFinalAssignedCents ?? 0,
      freeDeliveryUnlocked:
        event.groupDeliveryFinalFreeUnlocked ?? false,
      cancelledPendingOrders:
        event.groupDeliveryFinalCancelledPendingOrders ?? 0,
    });

    if (!sent) {
      await this.releaseClosedClaim(eventId, claimAt);
      return;
    }

    await this.prisma.pickupEvent.updateMany({
      where: {
        id: eventId,
        telegramGroupClosedNotifiedAt: null,
        telegramGroupClosedNotificationClaimedAt:
          claimAt,
      },
      data: {
        telegramGroupClosedNotifiedAt: new Date(),
        telegramGroupClosedNotificationClaimedAt: null,
      },
    });
  }

  private async releaseCompletedClaim(
    eventId: string,
    claimAt: Date,
  ) {
    await this.prisma.pickupEvent.updateMany({
      where: {
        id: eventId,
        telegramGroupCompletedNotifiedAt: null,
        telegramGroupCompletedNotificationClaimedAt:
          claimAt,
      },
      data: {
        telegramGroupCompletedNotificationClaimedAt: null,
      },
    });
  }

  private async releaseClosedClaim(
    eventId: string,
    claimAt: Date,
  ) {
    await this.prisma.pickupEvent.updateMany({
      where: {
        id: eventId,
        telegramGroupClosedNotifiedAt: null,
        telegramGroupClosedNotificationClaimedAt:
          claimAt,
      },
      data: {
        telegramGroupClosedNotificationClaimedAt: null,
      },
    });
  }
}
