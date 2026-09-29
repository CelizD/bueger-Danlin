import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AdminDayPanel,
  type AdminDayPanelData,
} from "./admin-day-panel";

const day: AdminDayPanelData = {
  date: "2026-10-03",
  startsAt: "2026-10-03T18:00:00.000Z",
  metrics: {
    totalOrders: 5,
    paidOrders: 4,
    pendingPaymentOrders: 1,
    combosToPrepare: 4,
    readyCombos: 1,
    receivedCents: 52_000,
    deliveryCashToCollectCents: 10_000,
  },
  groups: [
    {
      eventId: "event-1",
      eventCode: "SAT-UNIVERSIDAD",
      status: "OPEN",
      startsAt: "2026-10-03T18:00:00.000Z",
      closesAt: "2026-10-03T04:00:00.000Z",
      pickupPoint: {
        id: "point-1",
        code: "UNIVERSIDAD",
        name: "Universidad",
        address: "Entrada principal",
      },
      activeOrders: 3,
      paidOrders: 2,
      combosPaid: 3,
      paidComboCount: 3,
      combosToPrepare: 3,
      readyCombos: 0,
      minPaidCombos: 5,
      remainingPaidCombos: 2,
      transportCostCents: 10_000,
      estimatedFeeCents: 5_000,
      freeDeliveryUnlocked: false,
      finalized: false,
      finalizedAt: null,
      cashToCollectCents: 0,
    },
    {
      eventId: "event-2",
      eventCode: "SAT-CUCAPA",
      status: "CLOSED",
      startsAt: "2026-10-03T20:00:00.000Z",
      closesAt: "2026-10-03T04:00:00.000Z",
      pickupPoint: {
        id: "point-2",
        code: "CUCAPA",
        name: "Cucapá",
        address: null,
      },
      activeOrders: 2,
      paidOrders: 2,
      combosPaid: 2,
      paidComboCount: 2,
      combosToPrepare: 1,
      readyCombos: 1,
      minPaidCombos: 5,
      remainingPaidCombos: 3,
      transportCostCents: 10_000,
      estimatedFeeCents: null,
      freeDeliveryUnlocked: false,
      finalized: true,
      finalizedAt: "2026-10-03T04:00:00.000Z",
      cashToCollectCents: 10_000,
    },
  ],
  deliveryCharges: [
    {
      orderId: "order-1",
      orderCode: "H-C1",
      customerName: "Marta",
      customerPhone: "6643333333",
      pickupPointName: "Cucapá",
      finalized: true,
      freeDeliveryUnlocked: false,
      finalFeeCents: 5_000,
      estimatedFeeCents: null,
    },
    {
      orderId: "order-2",
      orderCode: "H-U1",
      customerName: "Ana",
      customerPhone: "6641111111",
      pickupPointName: "Universidad",
      finalized: false,
      freeDeliveryUnlocked: false,
      finalFeeCents: null,
      estimatedFeeCents: 5_000,
    },
  ],
};

describe("AdminDayPanel", () => {
  it("muestra resumen operativo, puntos y cobros por cliente", () => {
    const html = renderToStaticMarkup(
      <AdminDayPanel day={day} />,
    );

    expect(html).toContain("Panel del día");
    expect(html).toContain("Pedidos activos");
    expect(html).toContain("Hamburguesas por preparar");
    expect(html).toContain("$520");
    expect(html).toContain("$100");
    expect(html).toContain("Universidad");
    expect(html).toContain("Cucapá");
    expect(html).toContain("Marta");
    expect(html).toContain("Ana");
    expect(html).toContain("$50");
  });
});
