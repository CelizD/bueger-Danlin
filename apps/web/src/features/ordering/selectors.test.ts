import { describe, expect, it } from "vitest";
import {
  availableComboLimit,
  calculatePreviewTotal,
  modifierOptions,
  productInventoryLimit,
  unavailableIncludedModifierIds,
} from "./selectors";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
  PickupEvent,
} from "./types";

const combo: CatalogProduct = {
  id: "combo-1",
  slug: "combo-hamburguesa",
  name: "Hamburguesa + papas",
  description: null,
  type: "COMBO",
  priceCents: 13_000,
  modifierGroups: [
    {
      modifierGroup: {
        id: "ingredients",
        name: "Ingredientes",
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
            id: "cheese-extra",
            name: "Queso extra",
            kind: "EXTRA",
            priceDeltaCents: 1_000,
            defaultSelected: false,
          },
          {
            id: "meat-extra",
            name: "Carne extra",
            kind: "EXTRA",
            priceDeltaCents: 3_000,
            defaultSelected: false,
          },
        ],
      },
    },
  ],
};

const coke: CatalogProduct = {
  id: "coke-1",
  slug: "coca-cola-lata",
  name: "Coca-Cola lata",
  description: null,
  type: "BEVERAGE",
  priceCents: 3_000,
  modifierGroups: [],
};

const inventory: InventoryAvailability = {
  items: [],
  productLimits: {
    [combo.id]: 5,
    [coke.id]: 10,
  },
  modifierLimits: {
    lettuce: 0,
    "cheese-extra": 3,
    "meat-extra": 2,
  },
};

const pickupEvent: PickupEvent = {
  id: "event-1",
  code: "SAT-001",
  name: "Sábado",
  locationLabel: "Universidad",
  pickupPoint: {
    id: "point-1",
    code: "UNIVERSIDAD",
    name: "Universidad",
    address: null,
    latitude: null,
    longitude: null,
  },
  timezone: "America/Tijuana",
  startsAt: "2026-09-26T19:00:00.000Z",
  closesAt: "2026-09-26T04:00:00.000Z",
  maxCombos: 50,
  reservedCombos: 46,
  remainingCombos: 4,
  status: "OPEN",
  groupDelivery: {
    minPaidCombos: 5,
    paidComboCount: 3,
    remainingPaidCombos: 2,
    transportCostCents: 10_000,
    estimatedDeliveryFeeCents: 3_334,
    freeDeliveryUnlocked: false,
  },
};

describe("ordering selectors", () => {
  it("separa modificadores por tipo", () => {
    expect(modifierOptions(combo, "REMOVABLE").map((item) => item.id))
      .toEqual(["lettuce"]);

    expect(modifierOptions(combo, "EXTRA").map((item) => item.id))
      .toEqual(["cheese-extra", "meat-extra"]);
  });

  it("marca ingredientes incluidos agotados para retirarlos del nuevo combo", () => {
    expect(
      unavailableIncludedModifierIds(combo, inventory),
    ).toEqual(["lettuce"]);
  });

  it("respeta el menor límite entre evento e inventario", () => {
    const productLimit = productInventoryLimit(combo, inventory);

    expect(productLimit).toBe(5);
    expect(availableComboLimit(pickupEvent, productLimit)).toBe(4);
  });

  it("calcula combos, extras y bebidas en centavos", () => {
    const burgers: BurgerSelection[] = [
      {
        localId: "burger-1",
        removedIds: [],
        extraIds: ["cheese-extra"],
      },
      {
        localId: "burger-2",
        removedIds: [],
        extraIds: ["meat-extra"],
      },
    ];

    const total = calculatePreviewTotal(
      burgers,
      combo,
      coke,
      2,
      modifierOptions(combo, "EXTRA"),
    );

    expect(total).toBe(36_000);
  });

  it("multiplica el precio de extras por cantidad", () => {
    const burgers: BurgerSelection[] = [
      {
        localId: "burger-quantity",
        removedIds: [],
        extraIds: ["meat-extra"],
        modifierQuantities: {
          "meat-extra": 3,
        },
      },
    ];

    const total =
      calculatePreviewTotal(
        burgers,
        combo,
        coke,
        0,
        modifierOptions(
          combo,
          "EXTRA",
        ),
      );

    expect(total).toBe(22_000);
  });

  it("devuelve cero si no existe producto combo", () => {
    expect(
      calculatePreviewTotal([], undefined, coke, 2, []),
    ).toBe(0);
  });

  it("no permite capacidad sin evento abierto", () => {
    expect(availableComboLimit(null, 50)).toBe(0);
  });

  it("multiplica extras cuantificados en el total previo", () => {
    const burgers: BurgerSelection[] = [
      {
        localId: "burger-1",
        removedIds: [],
        extraIds: [],
        extraQuantities: {
          "cheese-extra": 3,
          "meat-extra": 2,
        },
      },
    ];

    const total = calculatePreviewTotal(
      burgers,
      combo,
      coke,
      0,
      modifierOptions(combo, "EXTRA"),
    );

    expect(total).toBe(22_000);
  });

});
