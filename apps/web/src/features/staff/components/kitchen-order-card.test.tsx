import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KitchenOrderCard } from "./kitchen-order-card";
import type { KitchenOrder } from "../kitchen/types";

const order: KitchenOrder = {
  id: "order-1",
  orderCode: "H-A1B2C3D4",
  status: "PAID",
  comboQuantity: 2,
  totalCents: 30_000,
  createdAt: "2026-10-03T20:00:00.000Z",
  customer: {
    name: "Cliente",
    phone: "+526641234567",
  },
  items: [
    {
      id: "item-1",
      productName: "Combo Hamburguesa + Papas",
      quantity: 1,
      position: 0,
      product: { type: "COMBO" },
      preparationSnapshot: {
        included: ["Tomate", "Queso"],
        removed: ["Lechuga"],
        extras: ["Carne extra"],
      },
      modifiers: [],
    },
    {
      id: "item-2",
      productName: "Combo Hamburguesa + Papas",
      quantity: 1,
      position: 1,
      product: { type: "COMBO" },
      preparationSnapshot: {
        included: ["Lechuga", "Queso"],
        removed: ["Tomate"],
        extras: ["Queso extra"],
      },
      modifiers: [],
    },
  ],
};

describe("KitchenOrderCard", () => {
  it("separa la preparación de cada hamburguesa", () => {
    const html = renderToStaticMarkup(
      <KitchenOrderCard
        order={order}
        busy={false}
        onTransition={vi.fn()}
      />,
    );

    const firstStart = html.indexOf("Hamburguesa 1");
    const secondStart = html.indexOf("Hamburguesa 2");

    expect(firstStart).toBeGreaterThanOrEqual(0);
    expect(secondStart).toBeGreaterThan(firstStart);

    const firstBurger = html.slice(firstStart, secondStart);
    const secondBurger = html.slice(secondStart);

    expect(firstBurger).toContain("Incluye");
    expect(firstBurger).toContain("NO PONER");
    expect(firstBurger).toContain("Sin Lechuga");
    expect(firstBurger).toContain("+ Carne extra");
    expect(firstBurger).not.toContain("Sin Tomate");
    expect(firstBurger).not.toContain("+ Queso extra");

    expect(secondBurger).toContain("Sin Tomate");
    expect(secondBurger).toContain("+ Queso extra");
    expect(secondBurger).not.toContain("Sin Lechuga");
    expect(secondBurger).not.toContain("+ Carne extra");
  });

  it("muestra cantidades totales sin etiquetas de extra", () => {
    const quantifiedOrder: KitchenOrder = {
      ...order,
      items: [
        {
          ...order.items[0]!,
          preparationSnapshot: {
            included: [],
            removed: [],
            extras: [],
            quantities: [
              "Carne ×3",
              "Queso ×4",
              "Tocino ×2",
              "Lechuga ×1",
              "Tomate ×0",
            ],
            sauces: [
              "Ketchup: Sí",
              "Mostaza: No",
            ],
            others: [],
          },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <KitchenOrderCard
        order={quantifiedOrder}
        busy={false}
        onTransition={vi.fn()}
      />,
    );

    expect(html).toContain("Cantidades");
    expect(html).toContain("Carne ×3");
    expect(html).toContain("Queso ×4");
    expect(html).toContain("Tomate ×0");
    expect(html).toContain("Aderezos");
    expect(html).toContain("Ketchup: Sí");
    expect(html).not.toContain("Carne extra");
    expect(html).not.toContain("+ Queso extra");
  });
});
