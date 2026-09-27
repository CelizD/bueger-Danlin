import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminDeliveryGroups,
  type AdminDeliveryGroup,
} from "./admin-delivery-groups";

const groups: AdminDeliveryGroup[] = [
  {
    eventId: "event-1",
    eventCode: "SAT-UNIVERSIDAD",
    eventName: "Universidad",
    status: "CLOSED",
    startsAt: "2026-10-03T19:00:00.000Z",
    closesAt: "2026-10-03T04:00:00.000Z",
    pickupPoint: {
      id: "point-1",
      code: "UNIVERSIDAD",
      name: "Universidad",
      address: "Entrada principal",
    },
    minPaidOrders: 5,
    paidOrderCount: 3,
    remainingPaidOrders: 2,
    transportCostCents: 10_000,
    estimatedFeeCents: null,
    freeDeliveryUnlocked: false,
    finalized: true,
    finalizedAt: "2026-10-03T04:00:00.000Z",
    finalAssignedCents: 10_000,
    cashToCollectCents: 10_000,
  },
  {
    eventId: "event-2",
    eventCode: "SAT-CUCAPA",
    eventName: "Cucapá",
    status: "OPEN",
    startsAt: "2026-10-10T19:00:00.000Z",
    closesAt: "2026-10-10T04:00:00.000Z",
    pickupPoint: {
      id: "point-2",
      code: "CUCAPA",
      name: "Cucapá",
      address: null,
    },
    minPaidOrders: 5,
    paidOrderCount: 4,
    remainingPaidOrders: 1,
    transportCostCents: 10_000,
    estimatedFeeCents: 2_500,
    freeDeliveryUnlocked: false,
    finalized: false,
    finalizedAt: null,
    finalAssignedCents: null,
    cashToCollectCents: 0,
  },
];

describe("AdminDeliveryGroups", () => {
  it("muestra grupos, progreso y cobros", () => {
    const html = renderToStaticMarkup(
      <AdminDeliveryGroups
        groups={groups}
        selectedEventId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("Universidad");
    expect(html).toContain("Cucapá");
    expect(html).toContain("3 de 5");
    expect(html).toContain("4 de 5");
    expect(html).toContain("Cobrar");
    expect(html).toContain("$100");
    expect(html).toContain("$25");
    expect(html).toContain("cargo de cada cliente ya está congelado");
  });
});
