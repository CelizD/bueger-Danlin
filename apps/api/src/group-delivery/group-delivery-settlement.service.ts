import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";

type SettleOptions = {
  force?: boolean;
  now?: Date;
  actorUserId?: string | null;
  reason?: "cutoff" | "manual" | "recovery";
};

export function allocateTransportCost(
  orderIds: string[],
  transportCostCents: number,
  freeDeliveryUnlocked: boolean,
) {
  const result = new Map<string, number>();

  if (orderIds.length === 0) return result;

  if (freeDeliveryUnlocked || transportCostCents <= 0) {
    for (const orderId of orderIds) {
      result.set(orderId, 0);
    }

    return result;
  }

  const base = Math.floor(transportCostCents / orderIds.length);
  const remainder = transportCostCents % orderIds.length;

  orderIds.forEach((orderId, index) => {
    result.set(orderId, base + (index < remainder ? 1 : 0));
  });

  return result;
}

@Injectable()
export class GroupDeliverySettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly groupTelegram?: GroupTelegramNotificationService,
  ) {}

  async settleExpired(now = new Date()) {
    const candidates = await this.prisma.pickupEvent.findMany({
      where: {
        groupDeliveryFinalizedAt: null,
        OR: [
          {
            status: { in: ["OPEN", "SOLD_OUT"] },
            closesAt: { lte: now },
          },
          {
            status: "CLOSED",
          },
        ],
      },
      select: { id: true },
      orderBy: { closesAt: "asc" },
      take: 100,
    });

    const results = [];

    for (const candidate of candidates) {
      results.push(
        await this.settleEvent(candidate.id, {
          now,
          reason: "cutoff",
        }),
      );
    }

    await this.groupTelegram?.flushPending();

    return {
      checked: candidates.length,
      settled: results.filter((result) => result.settled).length,
      results,
    };
  }

  async settleEvent(
    eventId: string,
    options: SettleOptions = {},
  ) {
    const now = options.now ?? new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "PickupEvent"
        WHERE "id" = ${eventId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException("La entrega no existe.");
      }

      const event = await tx.pickupEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new NotFoundException("La entrega no existe.");
      }

      if (event.groupDeliveryFinalizedAt) {
        return {
          settled: false,
          alreadyFinalized: true,
          eventId: event.id,
          finalizedAt: event.groupDeliveryFinalizedAt,
          paidOrderCount: event.groupDeliveryFinalPaidCombos ?? 0,
          freeDeliveryUnlocked:
            event.groupDeliveryFinalFreeUnlocked ?? false,
          assignedCents:
            event.groupDeliveryFinalAssignedCents ?? 0,
        };
      }

      if (
        event.status === "CANCELLED" ||
        event.status === "COMPLETED"
      ) {
        return {
          settled: false,
          alreadyFinalized: false,
          eventId: event.id,
          reason: "FINAL_EVENT_STATUS",
        };
      }

      if (
        !options.force &&
        event.status !== "CLOSED" &&
        event.closesAt > now
      ) {
        return {
          settled: false,
          alreadyFinalized: false,
          eventId: event.id,
          reason: "NOT_DUE",
        };
      }

      const pendingOrders = await tx.order.findMany({
        where: {
          pickupEventId: event.id,
          status: "PENDING_PAYMENT",
          paymentStatus: { not: "PAID" },
        },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      let cancelledPendingOrders = 0;

      for (const pendingOrder of pendingOrders) {
        const changed = await tx.order.updateMany({
          where: {
            id: pendingOrder.id,
            status: "PENDING_PAYMENT",
            paymentStatus: { not: "PAID" },
          },
          data: {
            status: "CANCELLED",
            paymentStatus: "CANCELLED",
            reservationExpiresAt: null,
            cancelledAt: now,
          },
        });

        if (changed.count !== 1) {
          continue;
        }

        cancelledPendingOrders += 1;

        await tx.payment.updateMany({
          where: {
            orderId: pendingOrder.id,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          data: {
            status: "CANCELLED",
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: pendingOrder.id,
            from: "PENDING_PAYMENT",
            to: "CANCELLED",
            note:
              "Pedido cancelado automáticamente al cerrar el punto de entrega.",
          },
        });

        await this.inventory.releaseOrder(tx, pendingOrder.id);

        await tx.auditLog.create({
          data: {
            action: "ORDER_CANCELLED_AT_PICKUP_CUTOFF",
            entityType: "Order",
            entityId: pendingOrder.id,
            before: {
              status: pendingOrder.status,
              paymentStatus: pendingOrder.paymentStatus,
            },
            after: {
              status: "CANCELLED",
              paymentStatus: "CANCELLED",
            },
          },
        });
      }

      const paidOrders = await tx.order.findMany({
        where: {
          pickupEventId: event.id,
          paymentStatus: "PAID",
          status: {
            notIn: ["CANCELLED", "REFUNDED"],
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      const paidOrderCount = paidOrders.length;
      const freeDeliveryUnlocked =
        paidOrderCount >= event.freeDeliveryMinPaidCombos;

      const allocations = allocateTransportCost(
        paidOrders.map((order) => order.id),
        event.transportCostCents,
        freeDeliveryUnlocked,
      );

      let assignedCents = 0;

      for (const paidOrder of paidOrders) {
        const finalFeeCents = allocations.get(paidOrder.id) ?? 0;
        assignedCents += finalFeeCents;

        await tx.order.update({
          where: { id: paidOrder.id },
          data: {
            groupDeliveryFinalFeeCents: finalFeeCents,
            groupDeliveryFinalizedAt: now,
          },
        });
      }

      const updated = await tx.pickupEvent.update({
        where: { id: event.id },
        data: {
          status: "CLOSED",
          groupDeliveryFinalizedAt: now,
          groupDeliveryFinalPaidCombos: paidOrderCount,
          groupDeliveryFinalTransportCostCents:
            event.transportCostCents,
          groupDeliveryFinalAssignedCents: assignedCents,
          groupDeliveryFinalFreeUnlocked:
            freeDeliveryUnlocked,
          groupDeliveryFinalCancelledPendingOrders:
            cancelledPendingOrders,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: options.actorUserId ?? null,
          action: "GROUP_DELIVERY_FINALIZED",
          entityType: "PickupEvent",
          entityId: event.id,
          before: {
            status: event.status,
            finalizedAt: null,
          },
          after: {
            status: "CLOSED",
            reason:
              options.reason ??
              (options.force ? "manual" : "cutoff"),
            paidOrderCount,
            freeDeliveryMinPaidCombos:
              event.freeDeliveryMinPaidCombos,
            transportCostCents: event.transportCostCents,
            assignedCents,
            freeDeliveryUnlocked,
            cancelledPendingOrders,
            finalizedAt: now.toISOString(),
          },
        },
      });

      return {
        settled: true,
        alreadyFinalized: false,
        eventId: updated.id,
        finalizedAt: now,
        paidOrderCount,
        freeDeliveryUnlocked,
        transportCostCents: event.transportCostCents,
        assignedCents,
        cancelledPendingOrders,
      };
    });

    if (
      result.settled ||
      result.alreadyFinalized
    ) {
      await this.groupTelegram?.flushEvent(eventId);
    }

    return result;
  }

  async assertNotFinalized(eventId: string) {
    const event = await this.prisma.pickupEvent.findUnique({
      where: { id: eventId },
      select: {
        groupDeliveryFinalizedAt: true,
      },
    });

    if (event?.groupDeliveryFinalizedAt) {
      throw new ConflictException(
        "El grupo ya fue cerrado y su costo final de envío está congelado.",
      );
    }
  }
}
