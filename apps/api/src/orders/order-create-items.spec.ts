import { describe, expect, it, vi } from "vitest";
import { prepareOrderItems } from "./order-create-items.js";

function productFixture() {
  return {
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
              key: "included-lettuce",
              name: "Lechuga",
              kind: "REMOVABLE",
              priceDeltaCents: 0,
            },
            {
              id: "tomato",
              key: "included-tomato",
              name: "Tomate",
              kind: "REMOVABLE",
              priceDeltaCents: 0,
            },
            {
              id: "included-cheese",
              key: "included-cheese",
              name: "Queso",
              kind: "REMOVABLE",
              priceDeltaCents: 0,
            },
            {
              id: "included-ketchup",
              key: "included-ketchup",
              name: "Ketchup",
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
              id: "extra-meat",
              key: "extra-meat",
              name: "Carne extra",
              kind: "EXTRA",
              priceDeltaCents: 3_000,
            },
            {
              id: "extra-cheese",
              key: "extra-cheese",
              name: "Queso extra",
              kind: "EXTRA",
              priceDeltaCents: 1_000,
            },
            {
              id: "extra-lettuce",
              key: "extra-lettuce",
              name: "Lechuga extra",
              kind: "EXTRA",
              priceDeltaCents: 0,
            },
            {
              id: "extra-mayonnaise",
              key: "extra-mayonnaise",
              name: "Mayonesa",
              kind: "EXTRA",
              priceDeltaCents: 0,
            },
          ],
        },
      },
    ],
  };
}

function txWithProduct() {
  return {
    product: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          productFixture(),
        ]),
    },
  };
}

describe("prepareOrderItems", () => {
  it("mantiene compatible el flujo legacy de removidos y extras", async () => {
    const result =
      await prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [
              "lettuce",
            ],
            extraModifierOptionIds: [
              "extra-cheese",
            ],
          },
        ] as any,
      );

    expect(
      result.preparedItems[0]
        ?.preparationSnapshot,
    ).toMatchObject({
      included: [
        "Tomate",
        "Queso",
        "Ketchup",
      ],
      removed: ["Lechuga"],
      extras: ["Queso extra"],
      quantities: [
        "Carne ×1",
        "Queso ×2",
        "Tocino ×0",
        "Lechuga ×0",
        "Tomate ×1",
        "Cebolla ×0",
        "Pepinillos ×0",
      ],
      sauces: [
        "Ketchup: Sí",
        "Mayonesa: No",
      ],
    });

    expect(result.totalCents).toBe(
      14_000,
    );

    expect(
      result.preparedItems[0]
        ?.modifiers,
    ).toEqual([
      expect.objectContaining({
        modifierOptionId:
          "lettuce",
        optionName: "Lechuga",
        removed: true,
      }),
      expect.objectContaining({
        modifierOptionId:
          "extra-cheese",
        optionName:
          "Queso extra",
        quantity: 1,
        removed: false,
        priceDeltaCents: 1_000,
      }),
    ]);
  });

  it("multiplica precio y guarda cantidades reales de ingredientes", async () => {
    const result =
      await prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [],
            extraModifierOptionIds: [
              "extra-meat",
              "extra-cheese",
              "extra-lettuce",
            ],
            modifierQuantities: [
              {
                modifierOptionId:
                  "extra-lettuce",
                quantity: 2,
              },
              {
                modifierOptionId:
                  "extra-meat",
                quantity: 3,
              },
              {
                modifierOptionId:
                  "extra-cheese",
                quantity: 2,
              },
            ],
          },
        ] as any,
      );

    expect(result.totalCents).toBe(
      24_000,
    );

    expect(
      result.preparedItems[0]
        ?.preparationSnapshot,
    ).toMatchObject({
      included: [
        "Lechuga",
        "Tomate",
        "Queso",
        "Ketchup",
      ],
      removed: [],
      extras: [
        "Carne extra ×3",
        "Queso extra ×2",
        "Lechuga extra ×2",
      ],
      quantities: [
        "Carne ×4",
        "Queso ×3",
        "Tocino ×0",
        "Lechuga ×3",
        "Tomate ×1",
        "Cebolla ×0",
        "Pepinillos ×0",
      ],
    });

    expect(
      result.preparedItems[0]
        ?.modifiers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modifierOptionId:
            "extra-lettuce",
          quantity: 2,
          removed: false,
        }),
        expect.objectContaining({
          modifierOptionId:
            "extra-meat",
          quantity: 3,
          priceDeltaCents:
            3_000,
          removed: false,
        }),
        expect.objectContaining({
          modifierOptionId:
            "extra-cheese",
          quantity: 2,
          priceDeltaCents:
            1_000,
          removed: false,
        }),
      ]),
    );
  });

  it("rechaza quitar el queso base", async () => {
    await expect(
      prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [
              "included-cheese",
            ],
            extraModifierOptionIds: [],
          },
        ] as any,
      ),
    ).rejects.toThrow(
      "Queso debe tener mínimo 1 porción.",
    );
  });

  it("rechaza cantidades para un aderezo Sí/No", async () => {
    await expect(
      prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [],
            extraModifierOptionIds: [
              "extra-mayonnaise",
            ],
            modifierQuantities: [
              {
                modifierOptionId:
                  "extra-mayonnaise",
                quantity: 2,
              },
            ],
          },
        ] as any,
      ),
    ).rejects.toThrow(
      "Mayonesa solo admite selección Sí/No.",
    );
  });

  it("rechaza porciones gratuitas adicionales de un ingrediente con extra pagado", async () => {
    await expect(
      prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [],
            extraModifierOptionIds: [],
            modifierQuantities: [
              {
                modifierOptionId:
                  "included-cheese",
                quantity: 2,
              },
            ],
          },
        ] as any,
      ),
    ).rejects.toThrow(
      "Las porciones adicionales de Queso deben enviarse como extra.",
    );
  });

  it("rechaza más de cinco carnes totales", async () => {
    await expect(
      prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [],
            extraModifierOptionIds: [
              "extra-meat",
            ],
            modifierQuantities: [
              {
                modifierOptionId:
                  "extra-meat",
                quantity: 5,
              },
            ],
          },
        ] as any,
      ),
    ).rejects.toThrow(
      "La hamburguesa puede tener como máximo 5 porciones de carne.",
    );
  });

  it("rechaza más de cinco porciones combinadas de queso", async () => {
    await expect(
      prepareOrderItems(
        txWithProduct(),
        [
          {
            productId: "combo-1",
            quantity: 1,
            removedModifierOptionIds: [],
            extraModifierOptionIds: [
              "extra-cheese",
            ],
            modifierQuantities: [
              {
                modifierOptionId:
                  "extra-cheese",
                quantity: 5,
              },
            ],
          },
        ] as any,
      ),
    ).rejects.toThrow(
      "Queso puede tener como máximo 5 porciones.",
    );
  });
});
