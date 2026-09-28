import type { fetchDashboardEvents } from "./admin-dashboard-events.js";
import type { fetchDashboardOrders } from "./admin-dashboard-queries.js";
import {
  CANCELLED_STATUSES,
  isEffectiveSale,
  TO_PREPARE_STATUSES,
} from "./admin-dashboard-utils.js";

type DashboardEvents = Awaited<
  ReturnType<typeof fetchDashboardEvents>
>;

type DashboardOrderResults = Awaited<
  ReturnType<typeof fetchDashboardOrders>
>;

type DayOrders = DashboardOrderResults[1];

export function buildDashboardDay(
  dayAnchor:
    | DashboardEvents[number]
    | null,
  dayKey: string | null,
  dayEvents: DashboardEvents,
  dayOrders: DayOrders,
) {
  if (!dayAnchor) {
    return null;
  }

  const activeDayOrders =
    dayOrders.filter(
      (order) =>
        !CANCELLED_STATUSES.includes(
          order.status as
            (typeof CANCELLED_STATUSES)[number],
        ),
    );

  const paidDayOrders =
    dayOrders.filter(isEffectiveSale);

  const dayGroups = dayEvents.map(
    (event) => {
      const eventOrders =
        dayOrders.filter(
          (order) =>
            order.pickupEventId ===
            event.id,
        );

      const activeOrders =
        eventOrders.filter(
          (order) =>
            !CANCELLED_STATUSES.includes(
              order.status as
                (typeof CANCELLED_STATUSES)[number],
            ),
        );

      const paidOrders =
        eventOrders.filter(
          isEffectiveSale,
        );

      const finalized =
        !!event.groupDeliveryFinalizedAt;

      const paidOrderCount =
        finalized
          ? event.groupDeliveryFinalPaidOrders ??
            paidOrders.length
          : paidOrders.length;

      const freeDeliveryUnlocked =
        finalized
          ? event.groupDeliveryFinalFreeUnlocked ??
            false
          : paidOrderCount >=
            event.freeDeliveryMinPaidOrders;

      const estimatedFeeCents =
        finalized
          ? null
          : freeDeliveryUnlocked
            ? 0
            : paidOrderCount > 0
              ? Math.ceil(
                  event.transportCostCents /
                    paidOrderCount,
                )
              : null;

      return {
        eventId: event.id,
        eventCode: event.code,
        status: event.status,
        startsAt: event.startsAt,
        closesAt: event.closesAt,
        pickupPoint:
          event.pickupPoint,
        activeOrders:
          activeOrders.length,
        paidOrders: paidOrderCount,
        combosPaid: paidOrders.reduce(
          (sum, order) =>
            sum +
            order.comboQuantity,
          0,
        ),
        combosToPrepare:
          paidOrders
            .filter(
              (order) =>
                TO_PREPARE_STATUSES.includes(
                  order.status as
                    (typeof TO_PREPARE_STATUSES)[number],
                ),
            )
            .reduce(
              (sum, order) =>
                sum +
                order.comboQuantity,
              0,
            ),
        readyCombos:
          paidOrders
            .filter(
              (order) =>
                order.status ===
                "READY",
            )
            .reduce(
              (sum, order) =>
                sum +
                order.comboQuantity,
              0,
            ),
        minPaidOrders:
          event.freeDeliveryMinPaidOrders,
        remainingPaidOrders:
          Math.max(
            0,
            event.freeDeliveryMinPaidOrders -
              paidOrderCount,
          ),
        transportCostCents:
          finalized
            ? event.groupDeliveryFinalTransportCostCents ??
              event.transportCostCents
            : event.transportCostCents,
        estimatedFeeCents,
        freeDeliveryUnlocked,
        finalized,
        finalizedAt:
          event.groupDeliveryFinalizedAt,
        cashToCollectCents:
          paidOrders.reduce(
            (sum, order) =>
              sum +
              (order.groupDeliveryFinalFeeCents ??
                0),
            0,
          ),
      };
    },
  );

  const groupByEventId = new Map(
    dayGroups.map((group) => [
      group.eventId,
      group,
    ]),
  );

  const deliveryCharges =
    paidDayOrders.map((order) => {
      const group =
        groupByEventId.get(
          order.pickupEventId,
        );

      const finalized =
        group?.finalized ?? false;

      const freeDeliveryUnlocked =
        group?.freeDeliveryUnlocked ??
        false;

      return {
        orderId: order.id,
        orderCode:
          order.orderCode,
        customerName:
          order.customer.name,
        customerPhone:
          order.customer.phone,
        pickupPointName:
          group?.pickupPoint.name ??
          "Punto de entrega",
        finalized,
        freeDeliveryUnlocked,
        finalFeeCents:
          finalized
            ? order.groupDeliveryFinalFeeCents ??
              0
            : null,
        estimatedFeeCents:
          finalized
            ? null
            : group?.estimatedFeeCents ??
              null,
      };
    });

  return {
    date: dayKey,
    startsAt: dayEvents
      .map(
        (event) =>
          event.startsAt,
      )
      .sort(
        (a, b) =>
          a.getTime() -
          b.getTime(),
      )[0],
    metrics: {
      totalOrders:
        activeDayOrders.length,
      paidOrders:
        paidDayOrders.length,
      pendingPaymentOrders:
        activeDayOrders.filter(
          (order) =>
            order.paymentStatus ===
            "PENDING",
        ).length,
      combosToPrepare:
        paidDayOrders
          .filter(
            (order) =>
              TO_PREPARE_STATUSES.includes(
                order.status as
                  (typeof TO_PREPARE_STATUSES)[number],
              ),
          )
          .reduce(
            (sum, order) =>
              sum +
              order.comboQuantity,
            0,
          ),
      readyCombos:
        paidDayOrders
          .filter(
            (order) =>
              order.status === "READY",
          )
          .reduce(
            (sum, order) =>
              sum +
              order.comboQuantity,
            0,
          ),
      receivedCents:
        paidDayOrders.reduce(
          (sum, order) =>
            sum +
            order.totalCents,
          0,
        ),
      deliveryCashToCollectCents:
        paidDayOrders.reduce(
          (sum, order) =>
            sum +
            (order.groupDeliveryFinalFeeCents ??
              0),
          0,
        ),
    },
    groups: dayGroups,
    deliveryCharges,
  };
}
