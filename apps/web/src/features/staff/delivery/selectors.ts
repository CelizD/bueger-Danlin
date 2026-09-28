import type { DeliveryOrder } from "./types";

export function filterDeliveryOrders(
  orders: DeliveryOrder[],
  query: string,
) {
  const normalized =
    query.trim().toLowerCase();

  if (!normalized) {
    return orders;
  }

  return orders.filter(
    (order) =>
      order.orderCode
        .toLowerCase()
        .includes(normalized) ||
      order.customer.name
        .toLowerCase()
        .includes(normalized) ||
      order.customer.phone.includes(
        normalized,
      ),
  );
}

export function splitDeliveryOrders(
  orders: DeliveryOrder[],
) {
  return {
    ready: orders.filter(
      (order) => order.status === "READY",
    ),
    delivered: orders.filter(
      (order) =>
        order.status === "DELIVERED",
    ),
  };
}
