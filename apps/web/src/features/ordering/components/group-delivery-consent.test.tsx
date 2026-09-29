import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PickupEvent } from "../types";
import { GroupDeliveryConsent } from "./group-delivery-consent";

const event: PickupEvent = {
  id: "event-1",
  code: "SAT-UNIVERSIDAD",
  name: "Universidad",
  locationLabel: "Universidad",
  pickupPoint: {
    id: "point-1",
    code: "UNIVERSIDAD",
    name: "Universidad",
    address: null,
    latitude: null,
    longitude: null,
  },
  timezone: "America/Tijuana",
  startsAt: "2026-10-03T17:00:00.000Z",
  closesAt: "2026-10-03T04:00:00.000Z",
  maxCombos: 50,
  reservedCombos: 4,
  remainingCombos: 46,
  status: "OPEN",
  groupDelivery: {
    minPaidCombos: 5,
    paidOrderCount: 4,
    remainingPaidCombos: 1,
    transportCostCents: 10_000,
    estimatedDeliveryFeeCents: 2_500,
    freeDeliveryUnlocked: false,
  },
};

describe("GroupDeliveryConsent", () => {
  it("muestra estimado y exige aceptación", () => {
    const html = renderToStaticMarkup(
      <GroupDeliveryConsent
        event={event}
        checked={false}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("4 de 5 pedidos pagados");
    expect(html).toContain("$25");
    expect(html).toContain("Entiendo y acepto");
    expect(html).toContain("required");
    expect(html).toContain('type="checkbox"');
  });
});
