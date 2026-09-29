import type {
  KitchenColumns,
  KitchenOrder,
} from "./types";

export function splitKitchenOrders(
  orders: KitchenOrder[],
): KitchenColumns {
  return {
    NEW: orders.filter(
      (order) =>
        order.status === "PAID" ||
        order.status === "CONFIRMED",
    ),
    PREPARING: orders.filter(
      (order) =>
        order.status === "PREPARING",
    ),
    READY: orders.filter(
      (order) => order.status === "READY",
    ),
  };
}

export function kitchenStatusTitle(
  status: KitchenOrder["status"],
) {
  if (status === "PREPARING") {
    return "Preparando";
  }

  if (status === "READY") {
    return "Listo";
  }

  return "Nuevo";
}
