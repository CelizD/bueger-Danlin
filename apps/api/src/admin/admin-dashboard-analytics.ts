import type { fetchDashboardOrders } from "./admin-dashboard-queries.js";
import { isEffectiveSale } from "./admin-dashboard-utils.js";

type DashboardOrderResults = Awaited<
  ReturnType<typeof fetchDashboardOrders>
>;

type AnalyticsOrders = DashboardOrderResults[0];

export function summarizeDashboardOrders(
  orders: AnalyticsOrders,
) {
  const effectiveSales =
    orders.filter(isEffectiveSale);

  const revenueCents = effectiveSales.reduce(
    (sum, order) =>
      sum + order.totalCents,
    0,
  );

  const combosSold = effectiveSales.reduce(
    (sum, order) =>
      sum + order.comboQuantity,
    0,
  );

  const averageTicketCents =
    effectiveSales.length > 0
      ? Math.round(
          revenueCents /
            effectiveSales.length,
        )
      : 0;

  const cancelledOrders = orders.filter(
    (order) =>
      order.status === "CANCELLED",
  ).length;

  const refundedOrders = orders.filter(
    (order) =>
      order.status === "REFUNDED" ||
      order.paymentStatus === "REFUNDED",
  ).length;

  const noShowOrders = orders.filter(
    (order) =>
      order.status === "NO_SHOW",
  ).length;

  const extrasMap = new Map<
    string,
    {
      quantity: number;
      revenueCents: number;
    }
  >();

  let cokesSold = 0;

  for (const order of effectiveSales) {
    for (const item of order.items) {
      if (
        item.product.slug ===
        "coca-cola-lata"
      ) {
        cokesSold += item.quantity;
      }

      for (const modifier of item.modifiers) {
        if (
          modifier.removed ||
          modifier.priceDeltaCents <= 0
        ) {
          continue;
        }

        const current =
          extrasMap.get(
            modifier.optionName,
          ) ?? {
            quantity: 0,
            revenueCents: 0,
          };

        current.quantity +=
          modifier.quantity;
        current.revenueCents +=
          modifier.priceDeltaCents *
          modifier.quantity;

        extrasMap.set(
          modifier.optionName,
          current,
        );
      }
    }
  }

  const topExtras = [
    ...extrasMap.entries(),
  ]
    .map(([name, value]) => ({
      name,
      ...value,
    }))
    .sort((a, b) => {
      if (
        b.quantity !== a.quantity
      ) {
        return (
          b.quantity - a.quantity
        );
      }

      return (
        b.revenueCents -
        a.revenueCents
      );
    })
    .slice(0, 8);

  const eventMap = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      startsAt: Date;
      revenueCents: number;
      combosSold: number;
      paidOrders: number;
    }
  >();

  for (const order of effectiveSales) {
    const existing =
      eventMap.get(
        order.pickupEventId,
      ) ?? {
        id: order.pickupEvent.id,
        code: order.pickupEvent.code,
        name: order.pickupEvent.name,
        startsAt:
          order.pickupEvent.startsAt,
        revenueCents: 0,
        combosSold: 0,
        paidOrders: 0,
      };

    existing.revenueCents +=
      order.totalCents;
    existing.combosSold +=
      order.comboQuantity;
    existing.paidOrders += 1;

    eventMap.set(
      order.pickupEventId,
      existing,
    );
  }

  const salesByEvent = [
    ...eventMap.values(),
  ]
    .sort(
      (a, b) =>
        b.startsAt.getTime() -
        a.startsAt.getTime(),
    )
    .slice(0, 8);

  return {
    metrics: {
      revenueCents,
      combosSold,
      cokesSold,
      averageTicketCents,
      effectiveOrders:
        effectiveSales.length,
      cancelledOrders,
      refundedOrders,
      noShowOrders,
    },
    topExtras,
    salesByEvent,
  };
}
