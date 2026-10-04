import type {
  BurgerSelection,
  PickupEvent,
} from "./types";

export const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatPickup(event: PickupEvent) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: event.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
}

export function newBurger(
  removedIds: string[] = [],
): BurgerSelection {
  return {
    localId: crypto.randomUUID(),
    removedIds,
    extraIds: [],
    extraQuantities: {},
  };
}
