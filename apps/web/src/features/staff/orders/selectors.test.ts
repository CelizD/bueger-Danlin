import { describe, expect, it } from "vitest";
import { filterAdminOrders } from "./selectors";
import type { OrdersResponse } from "./types";

const data: OrdersResponse = {
  summary: {
    totalOrders: 2,
    paidOrders: 1,
    pendingOrders: 1,
    totalCombos: 3,
    paidRevenueCents: 26000,
    finalDeliveryCashCents: 5000,
    activeGroups: 2,
    manualRefundsPending: 0,
    manualRefundsPendingCents: 0,
  },
  groups: [],
  orders: [
    {
      id: "o1",
      orderCode: "H-AAA111",
      status: "READY",
      paymentStatus: "PAID",
      totalCents: 26000,
      comboQuantity: 2,
      groupDeliveryFinalFeeCents: 0,
      groupDeliveryFinalizedAt: null,
      refundIssue: null,
      createdAt: "2026-09-27T20:00:00.000Z",
      customer: {
        name: "Daniel",
        phone: "+526641111111",
        email: null,
      },
      pickupEvent: {
        id: "e1",
        code: "EV-UNI",
        name: "Universidad",
        locationLabel: "Universidad",
        startsAt: "2026-10-03T16:00:00.000Z",
        closesAt: "2026-10-03T04:00:00.000Z",
        timezone: "America/Tijuana",
        pickupPoint: {
          id: "p1",
          code: "UNI",
          name: "Universidad",
          address: null,
        },
      },
      items: [],
      statusHistory: [],
      payments: [],
    },
    {
      id: "o2",
      orderCode: "H-BBB222",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      totalCents: 13000,
      comboQuantity: 1,
      groupDeliveryFinalFeeCents: null,
      groupDeliveryFinalizedAt: null,
      refundIssue: null,
      createdAt: "2026-09-27T21:00:00.000Z",
      customer: {
        name: "Ana",
        phone: "+526642222222",
        email: "ana@example.com",
      },
      pickupEvent: {
        id: "e2",
        code: "EV-CUC",
        name: "Cucapá",
        locationLabel: "Cucapá",
        startsAt: "2026-10-03T17:00:00.000Z",
        closesAt: "2026-10-03T04:00:00.000Z",
        timezone: "America/Tijuana",
        pickupPoint: {
          id: "p2",
          code: "CUC",
          name: "Cucapá",
          address: null,
        },
      },
      items: [],
      statusHistory: [],
      payments: [],
    },
  ],
};

describe("filterAdminOrders", () => {
  it("filtra por código, cliente, teléfono o punto", () => {
    expect(
      filterAdminOrders(data, "aaa111", "ALL", null),
    ).toHaveLength(1);

    expect(
      filterAdminOrders(data, "ana", "ALL", null),
    ).toHaveLength(1);

    expect(
      filterAdminOrders(data, "222222", "ALL", null),
    ).toHaveLength(1);

    expect(
      filterAdminOrders(data, "cucapá", "ALL", null),
    ).toHaveLength(1);
  });

  it("filtra por estado y por punto de entrega", () => {
    expect(
      filterAdminOrders(data, "", "PAID", null),
    ).toEqual([data.orders[0]]);

    expect(
      filterAdminOrders(data, "", "ALL", "e2"),
    ).toEqual([data.orders[1]]);
  });

  it("acepta el estado de pago PENDING", () => {
    expect(
      filterAdminOrders(data, "", "PENDING", null),
    ).toEqual([data.orders[1]]);
  });
});
