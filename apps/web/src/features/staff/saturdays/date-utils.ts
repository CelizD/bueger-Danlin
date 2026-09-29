import type {
  PickupEvent,
  SaturdayFormState,
} from "./types";

export const TIJUANA_TIMEZONE =
  "America/Tijuana";

function two(value: number) {
  return String(value).padStart(2, "0");
}

export function tijuanaParts(iso: string) {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIJUANA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).formatToParts(new Date(iso));

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return {
    date:
      values.year +
      "-" +
      values.month +
      "-" +
      values.day,
    time:
      values.hour +
      ":" +
      values.minute,
  };
}

function tijuanaOffset(date: string) {
  const probe = new Date(
    date + "T12:00:00Z",
  );

  const zoneName =
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIJUANA_TIMEZONE,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    })
      .formatToParts(probe)
      .find(
        (part) =>
          part.type === "timeZoneName",
      )?.value;

  const match = zoneName?.match(
    /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/,
  );

  if (!match) {
    throw new Error(
      "No se pudo determinar la zona horaria de Tijuana.",
    );
  }

  const sign = match[1];
  const hours = two(Number(match[2]));
  const minutes = two(
    Number(match[3] ?? "0"),
  );

  return (
    sign +
    hours +
    ":" +
    minutes
  );
}

export function tijuanaIso(
  date: string,
  time: string,
) {
  return new Date(
    date +
      "T" +
      time +
      ":00" +
      tijuanaOffset(date),
  ).toISOString();
}

export function nextSaturdayDefaults(): SaturdayFormState {
  const nowParts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIJUANA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(new Date());

  const values = Object.fromEntries(
    nowParts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  const weekdayIndex: Record<
    string,
    number
  > = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const base = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      12,
    ),
  );

  const weekday =
    values.weekday ?? "Sun";
  const currentDay =
    weekdayIndex[weekday] ?? 0;
  const daysUntilSaturday =
    (6 - currentDay + 7) % 7 || 7;

  base.setUTCDate(
    base.getUTCDate() +
      daysUntilSaturday,
  );

  const close = new Date(base);
  close.setUTCDate(
    close.getUTCDate() - 1,
  );

  const pickupDate =
    base.getUTCFullYear() +
    "-" +
    two(base.getUTCMonth() + 1) +
    "-" +
    two(base.getUTCDate());

  const closeDate =
    close.getUTCFullYear() +
    "-" +
    two(close.getUTCMonth() + 1) +
    "-" +
    two(close.getUTCDate());

  return {
    locationLabel: "Universidad",
    locationAddress: "",
    latitude: "",
    longitude: "",
    freeDeliveryMinPaidCombos: "5",
    transportCostMx: "0",
    pickupDate,
    pickupTime: "09:30",
    closeDate,
    closeTime: "21:00",
    maxCombos: "50",
  };
}

export function statusText(
  status: PickupEvent["status"],
) {
  const labels: Record<
    PickupEvent["status"],
    string
  > = {
    DRAFT: "Borrador",
    OPEN: "Pedidos abiertos",
    SOLD_OUT: "Agotado",
    CLOSED: "Pedidos cerrados",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
  };

  return labels[status];
}

export function formatDate(
  iso: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: TIJUANA_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(iso));
}

export function formatShortDateTime(
  iso: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: TIJUANA_TIMEZONE,
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(iso));
}

export function formatMonth(
  iso: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: TIJUANA_TIMEZONE,
      month: "short",
    },
  )
    .format(new Date(iso))
    .replace(".", "")
    .toUpperCase();
}

export function formatDay(
  iso: string,
) {
  return new Intl.DateTimeFormat(
    "es-MX",
    {
      timeZone: TIJUANA_TIMEZONE,
      day: "2-digit",
    },
  ).format(new Date(iso));
}
