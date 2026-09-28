export const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NO_SHOW: "No recogido",
};
