export type BaseSauceSpriteId =
  | "ketchup"
  | "mustard"
  | "mayonnaise"
  | "ketchup-mustard"
  | "ketchup-mayonnaise"
  | "mustard-mayonnaise"
  | "ketchup-mustard-mayonnaise";

export type SauceSelection = {
  ketchup: boolean;
  mustard: boolean;
  mayonnaise: boolean;
  chipotle: boolean;
  bbqChipotle: boolean;
};

export type SauceVisualLayer = {
  layerId: string;
  spriteId: BaseSauceSpriteId | "chipotle" | "bbq-chipotle";
  y: number;
  scale: number;
  x: number;
};

export function baseSauceSpriteId({
  ketchup,
  mustard,
  mayonnaise,
}: Pick<
  SauceSelection,
  "ketchup" | "mustard" | "mayonnaise"
>): BaseSauceSpriteId | null {
  if (
    ketchup &&
    mustard &&
    mayonnaise
  ) {
    return "ketchup-mustard-mayonnaise";
  }

  if (ketchup && mustard) {
    return "ketchup-mustard";
  }

  if (ketchup && mayonnaise) {
    return "ketchup-mayonnaise";
  }

  if (mustard && mayonnaise) {
    return "mustard-mayonnaise";
  }

  if (ketchup) {
    return "ketchup";
  }

  if (mustard) {
    return "mustard";
  }

  if (mayonnaise) {
    return "mayonnaise";
  }

  return null;
}

export function buildSauceVisualLayers(
  selection: SauceSelection,
  sauceY: number,
): SauceVisualLayer[] {
  const layers: SauceVisualLayer[] = [];
  const base =
    baseSauceSpriteId(selection);

  if (base) {
    layers.push({
      layerId: "base-sauces",
      spriteId: base,
      y: sauceY,
      scale: 0.68,
      x: 0,
    });
  }

  if (selection.chipotle) {
    layers.push({
      layerId: "chipotle",
      spriteId: "chipotle",
      y: sauceY - 3,
      scale: 0.65,
      x: 0,
    });
  }

  if (selection.bbqChipotle) {
    layers.push({
      layerId: "bbq-chipotle",
      spriteId: "bbq-chipotle",
      y: sauceY - 6,
      scale: 0.64,
      x: 0,
    });
  }

  return layers;
}
