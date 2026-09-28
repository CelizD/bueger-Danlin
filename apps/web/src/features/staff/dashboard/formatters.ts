export const dashboardMoney =
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });

export function dashboardEventDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: "America/Tijuana",
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  ).format(new Date(value));
}

export function dashboardBarWidth(
  value: number,
  maxValue: number,
) {
  if (value <= 0 || maxValue <= 0) {
    return 5;
  }

  return Math.max(
    5,
    Math.round(
      (value / maxValue) * 100,
    ),
  );
}
