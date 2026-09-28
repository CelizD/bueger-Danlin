export const customerOrderMoney =
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

export const CUSTOMER_ORDER_STATUS_LABELS: Record<
  string,
  string
> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Listo para recoger",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Cancelado y reembolsado",
  NO_SHOW: "No recogido",
};

export function orderTokenStorageKey(
  orderCode: string,
) {
  return `burger-danlin:order-token:${orderCode}`;
}
