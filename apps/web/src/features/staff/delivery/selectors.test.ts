import {
  describe,
  expect,
  it,
} from "vitest";
import {
  filterDeliveryOrders,
  splitDeliveryOrders,
} from "./selectors";
import type { DeliveryOrder } from "./types";

const orders: DeliveryOrder[] = [
  {
    id: "o1",
    orderCode: "H-READY1",
    status: "READY",
    comboQuantity: 2,
    totalCents: 26000,
    customer: {
      name: "Daniel",
      phone: "+526641111111",
      email: null,
    },
    pickupEvent: {
      locationLabel: "Universidad",
      startsAt: "2026-10-03T16:00:00.000Z",
    },
    items: [],
  },
  {
    id: "o2",
    orderCode: "H-DONE22",
    status: "DELIVERED",
    comboQuantity: 1,
    totalCents: 13000,
    deliveredAt:
      "2026-10-03T18:00:00.000Z",
    customer: {
      name: "Ana",
      phone: "+526642222222",
      email: "ana@example.com",
    },
    pickupEvent: {
      locationLabel: "Cucapá",
      startsAt: "2026-10-03T17:00:00.000Z",
    },
    items: [],
  },
];

describe("delivery selectors", () => {
  it("busca por código, nombre o teléfono", () => {
    expect(
      filterDeliveryOrders(
        orders,
        "ready1",
      ),
    ).toEqual([orders[0]]);

    expect(
      filterDeliveryOrders(
        orders,
        "ana",
      ),
    ).toEqual([orders[1]]);

    expect(
      filterDeliveryOrders(
        orders,
        "222222",
      ),
    ).toEqual([orders[1]]);
  });

  it("separa listos y entregados", () => {
    expect(
      splitDeliveryOrders(orders),
    ).toEqual({
      ready: [orders[0]],
      delivered: [orders[1]],
    });
  });
});
