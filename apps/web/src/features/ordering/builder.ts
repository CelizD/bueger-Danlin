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


export function setIngredientQuantityBurger(
  burgers: BurgerSelection[],
  burgerId: string,
  includedOptionId: string | null,
  extraOptionId: string,
  totalQuantity: number,
  inventory: InventoryAvailability | null,
) {
  const min = includedOptionId ? 0 : 1;

  if (
    !Number.isInteger(totalQuantity) ||
    totalQuantity < min ||
    totalQuantity > 5
  ) {
    return {
      burgers,
      error:
        "La cantidad del ingrediente debe estar entre " +
        min +
        " y 5.",
    };
  }

  const target = burgers.find(
    (burger) => burger.localId === burgerId,
  );

  if (!target) {
    return {
      burgers,
      error: "No se encontró la hamburguesa.",
    };
  }

  const nextIncluded =
    includedOptionId !== null &&
    totalQuantity > 0;
  const extraQuantity = Math.max(
    0,
    totalQuantity - 1,
  );

  if (includedOptionId && nextIncluded) {
    const baseLimit =
      inventory?.modifierLimits[
        includedOptionId
      ];

    if (baseLimit !== undefined) {
      const includedElsewhere =
        burgers.filter(
          (burger) =>
            burger.localId !== burgerId &&
            !burger.removedIds.includes(
              includedOptionId,
            ),
        ).length;

      if (includedElsewhere + 1 > baseLimit) {
        return {
          burgers,
          error:
            "Ese ingrediente ya no tiene inventario disponible.",
        };
      }
    }
  }

  const extraLimit =
    inventory?.modifierLimits[
      extraOptionId
    ];

  if (
    extraLimit !== undefined &&
    extraQuantity > 0
  ) {
    const extrasElsewhere =
      burgers
        .filter(
          (burger) =>
            burger.localId !== burgerId,
        )
        .reduce(
          (sum, burger) =>
            sum +
            (burger.extraQuantities?.[
              extraOptionId
            ] ??
              (burger.extraIds.includes(
                extraOptionId,
              )
                ? 1
                : 0)),
          0,
        );

    if (
      extrasElsewhere + extraQuantity >
      extraLimit
    ) {
      return {
        burgers,
        error:
          "No hay inventario suficiente para esa cantidad.",
      };
    }
  }

  return {
    burgers: burgers.map((burger) => {
      if (burger.localId !== burgerId) {
        return burger;
      }

      const removedIds = includedOptionId
        ? nextIncluded
          ? burger.removedIds.filter(
              (id) =>
                id !== includedOptionId,
            )
          : burger.removedIds.includes(
                includedOptionId,
              )
            ? burger.removedIds
            : [
                ...burger.removedIds,
                includedOptionId,
              ]
        : burger.removedIds;

      const extraQuantities = {
        ...(burger.extraQuantities ?? {}),
      };

      if (extraQuantity > 0) {
        extraQuantities[
          extraOptionId
        ] = extraQuantity;
      } else {
        delete extraQuantities[
          extraOptionId
        ];
      }

      return {
        ...burger,
        removedIds,
        extraIds:
          burger.extraIds.filter(
            (id) => id !== extraOptionId,
          ),
        extraQuantities,
      };
    }),
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
