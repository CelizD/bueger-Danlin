export const CANCELLED_STATUSES = [
  "CANCELLED",
  "REFUNDED",
] as const;

export const TO_PREPARE_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
] as const;

export function isEffectiveSale(order: {
  status: string;
  paymentStatus: string;
}) {
  return (
    order.paymentStatus === "PAID" &&
    !CANCELLED_STATUSES.includes(
      order.status as (typeof CANCELLED_STATUSES)[number],
    )
  );
}

export function localDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tijuana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
