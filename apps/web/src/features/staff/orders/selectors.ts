import type {
  AdminOrder,
  OrdersResponse,
} from "./types";

export function filterAdminOrders(
  data: OrdersResponse | null,
  query: string,
  status: string,
  selectedEventId: string | null,
): AdminOrder[] {
  const normalizedQuery =
    query.trim().toLowerCase();

  return (
    data?.orders.filter((order) => {
      const matchesStatus =
        status === "ALL" ||
        order.status === status ||
        order.paymentStatus === status;

      const matchesGroup =
        selectedEventId === null ||
        order.pickupEvent.id ===
          selectedEventId;

      const matchesQuery =
        !normalizedQuery ||
        order.orderCode
          .toLowerCase()
          .includes(normalizedQuery) ||
        order.customer.name
          .toLowerCase()
          .includes(normalizedQuery) ||
        order.customer.phone.includes(
          normalizedQuery,
        ) ||
        order.pickupEvent.pickupPoint.name
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesStatus &&
        matchesGroup &&
        matchesQuery
      );
    }) ?? []
  );
}
