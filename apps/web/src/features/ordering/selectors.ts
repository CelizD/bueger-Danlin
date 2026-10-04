import { burgerModifierQuantity } from "./builder";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
  ModifierOption,
  PickupEvent,
} from "./types";

export function modifierOptions(
  product: CatalogProduct | undefined,
  kind: ModifierOption["kind"],
) {
  return (
    product?.modifierGroups
      .flatMap((group) => group.modifierGroup.options)
      .filter((option) => option.kind === kind) ?? []
  );
}

export function unavailableIncludedModifierIds(
  product: CatalogProduct | undefined,
  inventory: InventoryAvailability,
) {
  return modifierOptions(product, "REMOVABLE")
    .filter(
      (option) => inventory.modifierLimits[option.id] === 0,
    )
    .map((option) => option.id);
}

export function productInventoryLimit(
  product: CatalogProduct | undefined,
  inventory: InventoryAvailability | null,
) {
  if (!product) return 0;

  return (
    inventory?.productLimits[product.id] ??
    Number.MAX_SAFE_INTEGER
  );
}

export function availableComboLimit(
  event: PickupEvent | null,
  productLimit: number,
) {
  if (!event) return 0;

  return Math.min(event.remainingCombos, productLimit);
}

export function calculatePreviewTotal(
  burgers: BurgerSelection[],
  combo: CatalogProduct | undefined,
  drink: CatalogProduct | undefined,
  drinkQuantity: number,
  extraOptions: ModifierOption[],
) {
  if (!combo) return 0;

  const burgersTotal = burgers.reduce((sum, burger) => {
    const extras = extraOptions.reduce(
      (extraSum, option) => {
        const quantified =
          burger.extraQuantities?.[
            option.id
          ] ?? 0;
        const legacy =
          burger.extraIds.includes(
            option.id,
          )
            ? 1
            : 0;
        const quantity = Math.max(
          quantified,
          legacy,
        );

        return (
          extraSum +
          option.priceDeltaCents *
            quantity
        );
      },
      0,
    );

    return sum + combo.priceCents + extras;
  }, 0);

  return (
    burgersTotal +
    (drink?.priceCents ?? 0) * drinkQuantity
  );
}
