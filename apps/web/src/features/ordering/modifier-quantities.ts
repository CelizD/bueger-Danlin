import type {
  BurgerSelection,
  ModifierOption,
} from "./types";

export type ModifierQuantityUpdate = {
  option: ModifierOption;
  quantity: number;
};

export function burgerModifierQuantity(
  burger: BurgerSelection,
  option: ModifierOption,
) {
  if (option.kind === "REMOVABLE") {
    if (
      burger.removedIds.includes(
        option.id,
      )
    ) {
      return 0;
    }

    return (
      burger.modifierQuantities?.[
        option.id
      ] ?? 1
    );
  }

  if (option.kind === "EXTRA") {
    return (
      burger.modifierQuantities?.[
        option.id
      ] ??
      (burger.extraIds.includes(
        option.id,
      )
        ? 1
        : 0)
    );
  }

  return 0;
}
