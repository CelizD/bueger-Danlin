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

export function toggleRemovedBurger(
  burgers: BurgerSelection[],
  burgerId: string,
  optionId: string,
  inventory: InventoryAvailability | null,
) {
  const limit =
    inventory?.modifierLimits[optionId];
  const burger = burgers.find(
    (item) => item.localId === burgerId,
  );
  const tryingToInclude =
    burger?.removedIds.includes(optionId) ??
    false;

  if (
    tryingToInclude &&
    limit !== undefined
  ) {
    const includedElsewhere =
      burgers.filter(
        (item) =>
          item.localId !== burgerId &&
          !item.removedIds.includes(
            optionId,
          ),
      ).length;

    if (includedElsewhere >= limit) {
      return {
        burgers,
        error:
          "Ese ingrediente ya no tiene inventario disponible.",
      };
    }
  }

  return {
    burgers: burgers.map((item) =>
      item.localId === burgerId
        ? {
            ...item,
            removedIds:
              item.removedIds.includes(
                optionId,
              )
                ? item.removedIds.filter(
                    (id) => id !== optionId,
                  )
                : [
                    ...item.removedIds,
                    optionId,
                  ],
          }
        : item,
    ),
    error: null,
  };
}

export function toggleExtraBurger(
  burgers: BurgerSelection[],
  burgerId: string,
  optionId: string,
  inventory: InventoryAvailability | null,
) {
  const limit =
    inventory?.modifierLimits[optionId];
  const selectedCount = burgers.filter(
    (burger) =>
      burger.extraIds.includes(optionId),
  ).length;
  const burger = burgers.find(
    (item) => item.localId === burgerId,
  );
  const alreadySelected =
    burger?.extraIds.includes(optionId) ??
    false;

  if (
    !alreadySelected &&
    limit !== undefined &&
    selectedCount >= limit
  ) {
    return {
      burgers,
      error:
        "Ese extra ya no tiene inventario disponible.",
    };
  }

  return {
    burgers: burgers.map((item) =>
      item.localId === burgerId
        ? {
            ...item,
            extraIds:
              item.extraIds.includes(
                optionId,
              )
                ? item.extraIds.filter(
                    (id) => id !== optionId,
                  )
                : [
                    ...item.extraIds,
                    optionId,
                  ],
          }
        : item,
    ),
    error: null,
  };
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
          burgers.filter(
            (burger) =>
              !burger.removedIds.includes(
                option.id,
              ),
          ).length;

        return currentlyIncluded >= limit;
      })
      .map((option) => option.id);

  return [
    ...burgers,
    newBurger(removedForNewBurger),
  ];
}
