import type { PrismaService } from "../database/prisma.service.js";
import {
  CAPACITY_STATUSES,
  GROUP_EXCLUDED_STATUSES,
} from "./admin-pickup-event-rules.js";

export async function listAdminPickupEvents(
  prisma: PrismaService,
  now: Date,
) {
  const events = await prisma.pickupEvent.findMany({
    orderBy: { startsAt: "desc" },
    take: 80,
    include: {
      pickupPoint: true,
      orders: {
        select: {
          status: true,
          paymentStatus: true,
          comboQuantity: true,
          reservationExpiresAt: true,
        },
      },
    },
  });

  return Promise.all(
    events.map(async (event) => {
      const paidCombos = event.orders
        .filter((order) =>
          CAPACITY_STATUSES.includes(
            order.status as (typeof CAPACITY_STATUSES)[number],
          ),
        )
        .reduce(
          (sum, order) => sum + order.comboQuantity,
          0,
        );

      const pendingReservedCombos = event.orders
        .filter(
          (order) =>
            order.status === "PENDING_PAYMENT" &&
            !!order.reservationExpiresAt &&
            order.reservationExpiresAt > now,
        )
        .reduce(
          (sum, order) => sum + order.comboQuantity,
          0,
        );

      const reservedCombos =
        paidCombos + pendingReservedCombos;

      const paidOrderCount = event.orders.filter(
        (order) =>
          order.paymentStatus === "PAID" &&
          !GROUP_EXCLUDED_STATUSES.includes(
            order.status as (typeof GROUP_EXCLUDED_STATUSES)[number],
          ),
      ).length;

      const freeDeliveryUnlocked =
        paidOrderCount >= event.freeDeliveryMinPaidCombos;

      const estimatedDeliveryFeeCents =
        freeDeliveryUnlocked
          ? 0
          : paidOrderCount > 0
            ? Math.ceil(
                event.transportCostCents / paidOrderCount,
              )
            : null;

      let normalizedStatus = event.status;

      if (
        event.status === "OPEN" ||
        event.status === "SOLD_OUT"
      ) {
        if (event.closesAt <= now) {
          normalizedStatus = "CLOSED";
        } else if (reservedCombos >= event.maxCombos) {
          normalizedStatus = "SOLD_OUT";
        } else {
          normalizedStatus = "OPEN";
        }

        if (normalizedStatus !== event.status) {
          await prisma.pickupEvent.update({
            where: { id: event.id },
            data: { status: normalizedStatus },
          });
        }
      }

      return {
        id: event.id,
        code: event.code,
        name: event.name,
        locationLabel: event.locationLabel,
        pickupPoint: {
          id: event.pickupPoint.id,
          code: event.pickupPoint.code,
          name: event.pickupPoint.name,
          address: event.pickupPoint.address,
          latitude: event.pickupPoint.latitude,
          longitude: event.pickupPoint.longitude,
          active: event.pickupPoint.active,
        },
        timezone: event.timezone,
        startsAt: event.startsAt,
        closesAt: event.closesAt,
        maxCombos: event.maxCombos,
        status: normalizedStatus,
        paidCombos,
        pendingReservedCombos,
        reservedCombos,
        remainingCombos: Math.max(
          0,
          event.maxCombos - reservedCombos,
        ),
        orderCount: event.orders.length,
        groupDelivery: {
          minPaidOrders:
            event.freeDeliveryMinPaidCombos,
          paidOrderCount,
          remainingPaidOrders: Math.max(
            0,
            event.freeDeliveryMinPaidCombos -
              paidOrderCount,
          ),
          transportCostCents: event.transportCostCents,
          estimatedDeliveryFeeCents:
            event.groupDeliveryFinalizedAt &&
            event.groupDeliveryFinalAssignedCents != null &&
            event.groupDeliveryFinalPaidCombos &&
            event.groupDeliveryFinalPaidCombos > 0
              ? Math.ceil(
                  event.groupDeliveryFinalAssignedCents /
                    event.groupDeliveryFinalPaidCombos,
                )
              : estimatedDeliveryFeeCents,
          freeDeliveryUnlocked:
            event.groupDeliveryFinalizedAt
              ? event.groupDeliveryFinalFreeUnlocked ?? false
              : freeDeliveryUnlocked,
          finalized: !!event.groupDeliveryFinalizedAt,
          finalizedAt: event.groupDeliveryFinalizedAt,
          finalPaidOrderCount:
            event.groupDeliveryFinalPaidCombos,
          finalTransportCostCents:
            event.groupDeliveryFinalTransportCostCents,
          finalAssignedCents:
            event.groupDeliveryFinalAssignedCents,
        },
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      };
    }),
  );
}
