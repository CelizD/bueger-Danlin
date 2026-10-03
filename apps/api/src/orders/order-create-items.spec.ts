import { describe, expect, it, vi } from "vitest";
import { prepareOrderItems } from "./order-create-items.js";

describe("prepareOrderItems", () => {
  it("guarda un snapshot completo de preparación sin contaminar modificadores de precio", async () => {
    const tx = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "combo-1",
            name: "Combo Hamburguesa + Papas",
            type: "COMBO",
            priceCents: 13_000,
            modifierGroups: [
              {
                modifierGroup: {
                  active: true,
                  options: [
                    {
                      id: "lettuce",
                      name: "Lechuga",
                      kind: "REMOVABLE",
                      priceDeltaCents: 0,
                    },
                    {
                      id: "tomato",
                      name: "Tomate",
                      kind: "REMOVABLE",
                      priceDeltaCents: 0,
                    },
                  ],
                },
              },
              {
                modifierGroup: {
                  active: true,
                  options: [
                    {
                      id: "extra-cheese",
                      name: "Queso extra",
                      kind: "EXTRA",
                      priceDeltaCents: 1_000,
                    },
                  ],
                },
              },
            ],
          },
        ]),
      },
    };

    const result = await prepareOrderItems(
      tx,
      [
        {
          productId: "combo-1",
          quantity: 1,
          removedModifierOptionIds: ["lettuce"],
          extraModifierOptionIds: ["extra-cheese"],
        },
      ] as any,
    );

    expect(result.preparedItems[0]?.preparationSnapshot).toEqual({
      included: ["Tomate"],
      removed: ["Lechuga"],
      extras: ["Queso extra"],
    });

    expect(result.preparedItems[0]?.modifiers).toEqual([
      expect.objectContaining({
        modifierOptionId: "lettuce",
        optionName: "Lechuga",
        removed: true,
      }),
      expect.objectContaining({
        modifierOptionId: "extra-cheese",
        optionName: "Queso extra",
        removed: false,
        priceDeltaCents: 1_000,
      }),
    ]);

    expect(
      result.preparedItems[0]?.modifiers.some(
        (modifier) => modifier.modifierOptionId === "tomato",
      ),
    ).toBe(false);
  });
});
