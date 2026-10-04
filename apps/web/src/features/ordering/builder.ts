import { newBurger } from "./formatters";
import { unavailableIncludedModifierIds } from "./selectors";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
  ModifierOption,
} from "./types";

const EMPTY_INVENTORY: InventoryAvailability = {
  items: [],
  productLimits: {},
  modifierLimits: {},
};

export type ModifierQuantityUpdate = {
  option: ModifierOption;
  quantity: number;
};

export function burgerModifierQuantity(
  burger: BurgerSelection,
  option: ModifierOption,
) {
  if (option.kind === "REMOVABLE") {
    if (burger.removedIds.includes(option.id)) {
      return 0;
    }

    return burger.modifierQuantities[option.id] ?? 1;
  }

  if (option.kind === "EXTRA") {
    return (
      burger.modifierQuantities[option.id] ??
      (burger.extraIds.includes(option.id) ? 1 : 0)
    );
  }

  return 0;
}

export function burgersForPickupSelection(
  current: BurgerSelection[],
  nextLimit: number,
  combo: CatalogProduct | undefined,
  inventory: InventoryAvailability | null,
) {
  if (nextLimit <= 0) {
    return [];
  }

  if (current.length === 0) {
    return [
      newBurger(
        unavailableIncludedModifierIds(
          combo,
          inventory ?? EMPTY_INVENTORY,
        ),
      ),
    ];
  }

  return current.slice(0, nextLimit);
}

export function setBurgerModifierQuantities(
  burgers: BurgerSelection[],
  burgerId: string,
  updates: ModifierQuantityUpdate[],
  inventory: InventoryAvailability | null,
) {
  const target = burgers.find(
    (item) => item.localId === burgerId,
  );

  if (!target) {
    return {
      burgers,
      error: "No encontramos la hamburguesa.",
    };
  }

  for (const update of updates) {
    if (
      !Number.isInteger(update.quantity) ||
      update.quantity < 0 ||
      update.quantity > 5
    ) {
      return {
        burgers,
        error:
          "Cada ingrediente puede tener entre 0 y 5 porciones.",
      };
    }

    const limit =
      inventory?.modifierLimits[update.option.id];

    if (limit === undefined) {
      continue;
    }

    const usedElsewhere = burgers
      .filter(
        (burger) =>
          burger.localId !== burgerId,
      )
      .reduce(
        (sum, burger) =>
          sum +
          burgerModifierQuantity(
            burger,
            update.option,
          ),
        0,
      );

    if (
      usedElsewhere + update.quantity >
      limit
    ) {
      return {
        burgers,
        error:
          "No hay suficientes porciones de ese ingrediente en inventario.",
      };
    }
  }

  return {
    burgers: burgers.map((burger) => {
      if (burger.localId !== burgerId) {
        return burger;
      }

      const removedIds = [
        ...burger.removedIds,
      ];
      const extraIds = [
        ...burger.extraIds,
      ];
      const modifierQuantities = {
        ...burger.modifierQuantities,
      };

      for (const {
        option,
        quantity,
      } of updates) {
        if (
          option.kind === "REMOVABLE"
        ) {
          const removedIndex =
            removedIds.indexOf(option.id);

          if (quantity === 0) {
            if (removedIndex < 0) {
              removedIds.push(option.id);
            }
            delete modifierQuantities[
              option.id
            ];
          } else {
            if (removedIndex >= 0) {
              removedIds.splice(
                removedIndex,
                1,
              );
            }

            if (quantity === 1) {
              delete modifierQuantities[
                option.id
              ];
            } else {
              modifierQuantities[
                option.id
              ] = quantity;
            }
          }

          continue;
        }

        if (option.kind === "EXTRA") {
          const extraIndex =
            extraIds.indexOf(option.id);

          if (quantity === 0) {
            if (extraIndex >= 0) {
              extraIds.splice(
                extraIndex,
                1,
              );
            }
            delete modifierQuantities[
              option.id
            ];
          } else {
            if (extraIndex < 0) {
              extraIds.push(option.id);
            }

            if (quantity === 1) {
              delete modifierQuantities[
                option.id
              ];
            } else {
              modifierQuantities[
                option.id
              ] = quantity;
            }
          }
        }
      }

      return {
        ...burger,
        removedIds,
        extraIds,
        modifierQuantities,
      };
    }),
    error: null,
  };
}

export function toggleRemovedBurger(
  burgers: BurgerSelection[],
  burgerId: string,
  optionId: string,
  inventory: InventoryAvailability | null,
) {
  const burger = burgers.find(
    (item) => item.localId === burgerId,
  );

  if (!burger) {
    return {
      burgers,
      error: "No encontramos la hamburguesa.",
    };
  }

  const option: ModifierOption = {
    id: optionId,
    name: "",
    kind: "REMOVABLE",
    priceDeltaCents: 0,
    defaultSelected: true,
  };

  return setBurgerModifierQuantities(
    burgers,
    burgerId,
    [
      {
        option,
        quantity:
          burgerModifierQuantity(
            burger,
            option,
          ) === 0
            ? 1
            : 0,
      },
    ],
    inventory,
  );
}

export function toggleExtraBurger(
  burgers: BurgerSelection[],
  burgerId: string,
  optionId: string,
  inventory: InventoryAvailability | null,
) {
  const burger = burgers.find(
    (item) => item.localId === burgerId,
  );

  if (!burger) {
    return {
      burgers,
      error: "No encontramos la hamburguesa.",
    };
  }

  const option: ModifierOption = {
    id: optionId,
    name: "",
    kind: "EXTRA",
    priceDeltaCents: 0,
    defaultSelected: false,
  };

  return setBurgerModifierQuantities(
    burgers,
    burgerId,
    [
      {
        option,
        quantity:
          burgerModifierQuantity(
            burger,
            option,
          ) > 0
            ? 0
            : 1,
      },
    ],
    inventory,
  );
}

export function appendBurger(
  burgers: BurgerSelection[],
  removableOptions: ModifierOption[],
  inventory: InventoryAvailability | null,
) {
  const removedForNewBurger =
    removableOptions
      .filter((option) => {
        const limit =
          inventory?.modifierLimits[
            option.id
          ];

        if (limit === undefined) {
          return false;
        }

        const currentlyIncluded =
          burgers.reduce(
            (sum, burger) =>
              sum +
              burgerModifierQuantity(
                burger,
                option,
              ),
            0,
          );

        return currentlyIncluded >= limit;
      })
      .map((option) => option.id);

  return [
    ...burgers,
    newBurger(removedForNewBurger),
  ];
}
