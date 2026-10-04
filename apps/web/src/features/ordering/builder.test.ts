import {
  appendBurger,
  burgersForPickupSelection,
  setBurgerModifierQuantities,
} from "./builder";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
  ModifierOption,
} from "./types";
import {
  describe,
  expect,
  it,
} from "vitest";

const lettuce: ModifierOption = {
  id: "lettuce",
  key: "included-lettuce",
  name: "Lechuga",
  kind: "REMOVABLE",
  priceDeltaCents: 0,
  defaultSelected: true,
};

const meatExtra: ModifierOption = {
  id: "meat-extra",
  key: "extra-meat",
  name: "Carne extra",
  kind: "EXTRA",
  priceDeltaCents: 3_000,
  defaultSelected: false,
};

const combo: CatalogProduct = {
  id: "combo-1",
  slug: "combo",
  name: "Combo",
  description: null,
  type: "COMBO",
  priceCents: 13_000,
  modifierGroups: [
    {
      modifierGroup: {
        id: "mods",
        name: "Mods",
        active: true,
        options: [
          lettuce,
          meatExtra,
        ],
      },
    },
  ],
};

const inventory: InventoryAvailability = {
  items: [],
  productLimits: {
    "combo-1": 5,
  },
  modifierLimits: {
    lettuce: 5,
    "meat-extra": 4,
  },
};

const burgers: BurgerSelection[] = [
  {
    localId: "b1",
    removedIds: [],
    extraIds: [],
    modifierQuantities: {},
  },
];

describe("ordering builder rules", () => {
  it("recorta combos al cambiar a un punto con menor capacidad", () => {
    expect(
      burgersForPickupSelection(
        [
          ...burgers,
          {
            localId: "b2",
            removedIds: [],
            extraIds: [],
            modifierQuantities:
              {},
          },
        ],
        1,
        combo,
        inventory,
      ),
    ).toHaveLength(1);
  });

  it("guarda de 0 a 5 porciones de ingredientes", () => {
    const result =
      setBurgerModifierQuantities(
        burgers,
        "b1",
        [
          {
            option: lettuce,
            quantity: 3,
          },
          {
            option: meatExtra,
            quantity: 4,
          },
        ],
        inventory,
      );

    expect(result.error).toBeNull();
    expect(
      result.burgers[0]
        ?.modifierQuantities,
    ).toEqual({
      lettuce: 3,
      "meat-extra": 4,
    });
    expect(
      result.burgers[0]?.extraIds,
    ).toContain("meat-extra");
    expect(
      result.burgers[0]?.removedIds,
    ).not.toContain("lettuce");
  });

  it("rechaza cantidades negativas, decimales y mayores a cinco", () => {
    for (const quantity of [
      -1,
      1.5,
      6,
    ]) {
      const result =
        setBurgerModifierQuantities(
          burgers,
          "b1",
          [
            {
              option: lettuce,
              quantity,
            },
          ],
          inventory,
        );

      expect(result.error).toBe(
        "Cada ingrediente puede tener entre 0 y 5 porciones.",
      );
    }
  });

  it("convierte cantidad cero de un ingrediente incluido en removido", () => {
    const result =
      setBurgerModifierQuantities(
        burgers,
        "b1",
        [
          {
            option: lettuce,
            quantity: 0,
          },
        ],
        inventory,
      );

    expect(result.error).toBeNull();
    expect(
      result.burgers[0]?.removedIds,
    ).toContain("lettuce");
  });

  it("bloquea cantidades que exceden inventario", () => {
    const result =
      setBurgerModifierQuantities(
        burgers,
        "b1",
        [
          {
            option: meatExtra,
            quantity: 5,
          },
        ],
        inventory,
      );

    expect(result.error).toBe(
      "No hay suficientes porciones de ese ingrediente en inventario.",
    );
  });

  it("crea el siguiente combo removiendo ingredientes sin capacidad", () => {
    const exhaustedInventory: InventoryAvailability =
      {
        ...inventory,
        modifierLimits: {
          ...inventory.modifierLimits,
          lettuce: 1,
        },
      };

    const next = appendBurger(
      burgers,
      [lettuce],
      exhaustedInventory,
    );

    expect(next).toHaveLength(2);
    expect(
      next[1]?.removedIds,
    ).toContain("lettuce");
  });
});
