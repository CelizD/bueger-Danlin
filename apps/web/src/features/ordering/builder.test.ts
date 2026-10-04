import {
  appendBurger,
  burgersForPickupSelection,
  setIngredientQuantityBurger,
  toggleExtraBurger,
  toggleRemovedBurger,
} from "./builder";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
} from "./types";
import {
  describe,
  expect,
  it,
} from "vitest";

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
          {
            id: "lettuce",
            name: "Lechuga",
            kind: "REMOVABLE",
            priceDeltaCents: 0,
            defaultSelected: true,
          },
          {
            id: "cheese",
            name: "Queso",
            kind: "EXTRA",
            priceDeltaCents: 1_000,
            defaultSelected: false,
          },
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
    lettuce: 1,
    cheese: 1,
  },
};

const burgers: BurgerSelection[] = [
  {
    localId: "b1",
    removedIds: [],
    extraIds: ["cheese"],
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
          },
        ],
        1,
        combo,
        inventory,
      ),
    ).toHaveLength(1);
  });

  it("bloquea incluir un ingrediente cuando su inventario ya está ocupado", () => {
    const result =
      toggleRemovedBurger(
        [
          {
            localId: "b1",
            removedIds: [],
            extraIds: [],
          },
          {
            localId: "b2",
            removedIds: ["lettuce"],
            extraIds: [],
          },
        ],
        "b2",
        "lettuce",
        inventory,
      );

    expect(result.error).toBe(
      "Ese ingrediente ya no tiene inventario disponible.",
    );
  });

  it("bloquea un extra cuando se alcanzó su límite", () => {
    const result =
      toggleExtraBurger(
        burgers,
        "b2",
        "cheese",
        inventory,
      );

    expect(result.error).toBe(
      "Ese extra ya no tiene inventario disponible.",
    );
  });

  it("crea el siguiente combo removiendo ingredientes sin capacidad", () => {
    const next = appendBurger(
      burgers,
      combo.modifierGroups[0]!
        .modifierGroup.options.filter(
          (option) =>
            option.kind ===
            "REMOVABLE",
        ),
      inventory,
    );

    expect(next).toHaveLength(2);
    expect(
      next[1]?.removedIds,
    ).toContain("lettuce");
  });

  it("permite seleccionar hasta cinco porciones de un ingrediente", () => {
    const result =
      setIngredientQuantityBurger(
        [
          {
            localId: "b1",
            removedIds: [],
            extraIds: [],
            extraQuantities: {},
          },
        ],
        "b1",
        "lettuce",
        "cheese",
        5,
        {
          ...inventory,
          modifierLimits: {
            lettuce: 5,
            cheese: 4,
          },
        },
      );

    expect(result.error).toBeNull();
    expect(
      result.burgers[0]
        ?.extraQuantities?.cheese,
    ).toBe(4);
    expect(
      result.burgers[0]
        ?.removedIds,
    ).not.toContain("lettuce");
  });

});
