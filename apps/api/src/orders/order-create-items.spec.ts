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
    ).toEqual({
      included: [
        "Tomate",
        "Queso",
      ],
      removed: ["Lechuga"],
      extras: ["Queso extra"],
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
            ],
            modifierQuantities: [
              {
                modifierOptionId:
                  "lettuce",
                quantity: 3,
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
    ).toEqual({
      included: [
        "Lechuga ×3",
        "Tomate",
        "Queso",
      ],
      removed: [],
      extras: [
        "Carne extra ×3",
        "Queso extra ×2",
      ],
    });

    expect(
      result.preparedItems[0]
        ?.modifiers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modifierOptionId:
            "lettuce",
          quantity: 3,
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
