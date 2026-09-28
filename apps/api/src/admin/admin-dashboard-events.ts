import type { PrismaService } from "../database/prisma.service.js";
import { localDateKey } from "./admin-dashboard-utils.js";

export async function fetchDashboardEvents(
  prisma: PrismaService,
) {
  return prisma.pickupEvent.findMany({
    orderBy: { startsAt: "desc" },
    take: 30,
    select: {
      id: true,
      code: true,
      name: true,
      locationLabel: true,
      startsAt: true,
      closesAt: true,
      status: true,
      freeDeliveryMinPaidOrders: true,
      transportCostCents: true,
      groupDeliveryFinalizedAt: true,
      groupDeliveryFinalPaidOrders: true,
      groupDeliveryFinalTransportCostCents: true,
      groupDeliveryFinalAssignedCents: true,
      groupDeliveryFinalFreeUnlocked: true,
      pickupPoint: {
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
        },
      },
    },
  });
}

export function resolveDashboardDayContext(
  events: Awaited<
    ReturnType<typeof fetchDashboardEvents>
  >,
  pickupEventId: string | undefined,
  now: Date,
) {
  const selectedEvent =
    pickupEventId != null
      ? events.find(
          (event) => event.id === pickupEventId,
        ) ?? null
      : null;

  const nextActiveEvent =
    [...events]
      .filter(
        (event) =>
          ["OPEN", "SOLD_OUT"].includes(
            event.status,
          ) && event.closesAt > now,
      )
      .sort(
        (a, b) =>
          a.startsAt.getTime() -
          b.startsAt.getTime(),
      )[0] ?? null;

  const dayAnchor =
    selectedEvent ??
    nextActiveEvent ??
    events[0] ??
    null;

  const dayKey = dayAnchor
    ? localDateKey(dayAnchor.startsAt)
    : null;

  const dayEvents =
    dayKey == null
      ? []
      : events.filter(
          (event) =>
            localDateKey(event.startsAt) ===
            dayKey,
        );

  return {
    selectedEvent,
    dayAnchor,
    dayKey,
    dayEvents,
  };
}
