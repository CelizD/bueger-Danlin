import {
  describe,
  expect,
  it,
} from "vitest";
import {
  kitchenStatusTitle,
  splitKitchenOrders,
} from "./selectors";
import type { KitchenOrder } from "./types";

function order(
  id: string,
  status: KitchenOrder["status"],
): KitchenOrder {
  return {
    id,
    orderCode: "H-" + id,
    status,
    comboQuantity: 1,
    totalCents: 13000,
    createdAt:
      "2026-09-28T00:00:00.000Z",
    customer: {
      name: "Cliente",
      phone: "+526641234567",
    },
    items: [],
  };
}

describe("kitchen selectors", () => {
  it("separa nuevos, preparando y listos", () => {
    const paid = order("1", "PAID");
    const confirmed = order(
      "2",
      "CONFIRMED",
    );
    const preparing = order(
      "3",
      "PREPARING",
    );
    const ready = order("4", "READY");

    expect(
      splitKitchenOrders([
        paid,
        confirmed,
        preparing,
        ready,
      ]),
    ).toEqual({
      NEW: [paid, confirmed],
      PREPARING: [preparing],
      READY: [ready],
    });
  });

  it("mantiene las etiquetas de estado", () => {
    expect(
      kitchenStatusTitle("PAID"),
    ).toBe("Nuevo");
    expect(
      kitchenStatusTitle(
        "PREPARING",
      ),
    ).toBe("Preparando");
    expect(
      kitchenStatusTitle("READY"),
    ).toBe("Listo");
  });
});
