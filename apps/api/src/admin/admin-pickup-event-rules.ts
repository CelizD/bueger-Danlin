import { BadRequestException } from "@nestjs/common";

export const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

export const GROUP_EXCLUDED_STATUSES = [
  "CANCELLED",
  "REFUNDED",
] as const;

export type PickupPointInput = {
  locationLabel: string;
  locationAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export function assertPickupEventDates(
  startsAt: Date,
  closesAt: Date,
) {
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(closesAt.getTime())
  ) {
    throw new BadRequestException(
      "Las fechas no son válidas.",
    );
  }

  if (closesAt >= startsAt) {
    throw new BadRequestException(
      "El cierre de pedidos debe ser antes de la hora de entrega.",
    );
  }
}

export function assertPickupEventSaturday(startsAt: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tijuana",
    weekday: "short",
  }).format(startsAt);

  if (weekday !== "Sat") {
    throw new BadRequestException(
      "La fecha de entrega debe ser un sábado.",
    );
  }
}

export function buildPickupPointCode(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  if (!normalized) {
    throw new BadRequestException(
      "El nombre del punto no genera un código válido.",
    );
  }

  return normalized;
}

export function buildPickupEventCode(
  startsAt: Date,
  pickupPointCode: string,
) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tijuana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startsAt);

  return "SAT-" + date + "-" + pickupPointCode;
}

export function defaultPickupEventName(
  startsAt: Date,
  pickupPointName: string,
) {
  const date = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Tijuana",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(startsAt);

  return "Entrega " + pickupPointName + " · " + date;
}


export function assertGroupDeliveryCapacity(
  maxCombos: number,
  freeDeliveryMinPaidCombos: number,
) {
  if (
    freeDeliveryMinPaidCombos >
    maxCombos
  ) {
    throw new BadRequestException(
      "La meta de envío gratis no puede ser mayor al límite de combos.",
    );
  }
}
