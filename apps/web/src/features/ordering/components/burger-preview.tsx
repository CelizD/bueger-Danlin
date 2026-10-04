import {
  burgerModifierQuantity,
} from "@/features/ordering/modifier-quantities";
import type { CSSProperties } from "react";
import type {
  BurgerSelection,
  ModifierOption,
} from "@/features/ordering/types";

type BurgerPreviewProps = {
  burger: BurgerSelection;
  removableOptions: ModifierOption[];
  extraOptions: ModifierOption[];
  label: string;
};

type LayerStyle = CSSProperties & {
  "--burger-y": string;
  "--burger-scale"?: string;
  "--burger-x"?: string;
};

type Layer = {
  key: string;
  src?: string;
  spriteId?: string;
  active: boolean;
  y: number;
  z: number;
  scale?: number;
  x?: number;
};

type AssetRef = Pick<
  Layer,
  "src" | "spriteId"
>;

const ASSET_ROOT = "/burger-preview";
const SPRITE_PATH =
  `${ASSET_ROOT}/ingredients-sprite.svg`;

function optionByKey(
  options: ModifierOption[],
  key: string,
) {
  return options.find(
    (option) => option.key === key,
  );
}

function repeatedLayers({
  key,
  asset,
  count,
  y,
  step,
  z,
  scale = 1,
  x = 0,
}: {
  key: string;
  asset: AssetRef;
  count: number;
  y: number;
  step: number;
  z: number;
  scale?: number;
  x?: number;
}) {
  return Array.from(
    { length: Math.max(0, count) },
    (_, index): Layer => ({
      key: `${key}-${index + 1}`,
      ...asset,
      active: true,
      y: y - index * step,
      z: z + index,
      scale:
        scale -
        Math.min(index, 4) * 0.015,
      x:
        x +
        (index % 2 === 0
          ? -1
          : 1) *
          Math.min(index, 3) *
          2,
    }),
  );
}

function countAssetLayer({
  key,
  count,
  y,
  z,
  assets,
  fallbackStep,
  scale = 1,
}: {
  key: string;
  count: number;
  y: number;
  z: number;
  assets: Record<number, AssetRef>;
  fallbackStep: number;
  scale?: number;
}): Layer[] {
  if (count <= 0) {
    return [];
  }

  const exact = assets[count];

  if (exact) {
    return [
      {
        key: `${key}-${count}`,
        ...exact,
        active: true,
        y,
        z,
        scale,
      },
    ];
  }

  const single = assets[1];

  if (!single) {
    return [];
  }

  return repeatedLayers({
    key,
    asset: single,
    count,
    y,
    step: fallbackStep,
    z,
    scale,
  });
}

function sauceAsset(
  ketchup: boolean,
  mustard: boolean,
  mayonnaise: boolean,
): AssetRef | null {
  if (
    ketchup &&
    mustard &&
    mayonnaise
  ) {
    return {
      spriteId:
        "ketchup-mustard-mayonnaise",
    };
  }

  if (ketchup && mustard) {
    return {
      spriteId: "ketchup-mustard",
    };
  }

  if (ketchup && mayonnaise) {
    return {
      spriteId: "ketchup-mayonnaise",
    };
  }

  if (mustard && mayonnaise) {
    return {
      spriteId: "mustard-mayonnaise",
    };
  }

  if (ketchup) {
    return { spriteId: "ketchup" };
  }

  if (mustard) {
    return { spriteId: "mustard" };
  }

  if (mayonnaise) {
    return { spriteId: "mayonnaise" };
  }

  return null;
}

export function BurgerPreview({
  burger,
  removableOptions,
  extraOptions,
  label,
}: BurgerPreviewProps) {
  const quantity = (
    options: ModifierOption[],
    key: string,
  ) => {
    const option = optionByKey(
      options,
      key,
    );

    return option
      ? burgerModifierQuantity(
          burger,
          option,
        )
      : 0;
  };

  const extraQuantity = (
    key: string,
  ) =>
    quantity(
      extraOptions,
      key,
    );

  const removableQuantity = (
    key: string,
  ) =>
    quantity(
      removableOptions,
      key,
    );

  const meatCount =
    1 + extraQuantity("extra-meat");

  const cheeseCount =
    Math.min(
      1,
      removableQuantity(
        "included-cheese",
      ),
    ) +
    extraQuantity("extra-cheese");

  const baconCount =
    Math.min(
      1,
      removableQuantity(
        "included-bacon",
      ),
    ) +
    extraQuantity("extra-bacon");

  const lettuceCount =
    Math.min(
      1,
      removableQuantity(
        "included-lettuce",
      ),
    ) +
    extraQuantity("extra-lettuce");

  const tomatoCount =
    Math.min(
      1,
      removableQuantity(
        "included-tomato",
      ),
    ) +
    extraQuantity("extra-tomato");

  const whiteOnionCount =
    Math.min(
      1,
      removableQuantity(
        "included-white-onion",
      ),
    ) +
    extraQuantity("extra-white-onion");

  const picklesCount =
    extraQuantity("extra-pickles");

  const caramelizedOnionCount =
    removableQuantity(
      "included-caramelized-onion",
    );

  const ketchupSelected =
    removableQuantity(
      "included-ketchup",
    ) > 0;
  const mustardSelected =
    removableQuantity(
      "included-mustard",
    ) > 0;
  const mayonnaiseSelected =
    extraQuantity(
      "extra-mayonnaise",
    ) > 0;
  const chipotleSelected =
    extraQuantity(
      "extra-chipotle",
    ) > 0;
  const bbqChipotleSelected =
    extraQuantity(
      "extra-bbq-chipotle",
    ) > 0;

  const upperLift = Math.min(
    88,
    Math.max(0, meatCount - 1) * 11 +
      Math.max(0, cheeseCount - 1) * 7 +
      Math.max(0, baconCount - 1) * 5 +
      Math.max(0, lettuceCount - 1) * 3 +
      Math.max(0, tomatoCount - 1) * 2,
  );

  const meatLayers =
    countAssetLayer({
      key: "meat",
      count: meatCount,
      y: 82,
      z: 32,
      fallbackStep: 23,
      assets: {
        1: {
          src:
            `${ASSET_ROOT}/carne.svg`,
        },
        2: {
          src:
            `${ASSET_ROOT}/doblecarne.svg`,
        },
        3: {
          spriteId: "meat-3",
        },
        4: {
          spriteId: "meat-4",
        },
        5: {
          spriteId: "meat-5",
        },
      },
    });

  const cheeseLayers =
    countAssetLayer({
      key: "cheese",
      count: cheeseCount,
      y:
        43 -
        Math.max(
          0,
          meatCount - 1,
        ) *
          11,
      z: 44,
      fallbackStep: 9,
      assets: {
        1: {
          src:
            `${ASSET_ROOT}/queso.svg`,
        },
        2: {
          spriteId: "cheese-2",
        },
        3: {
          spriteId: "cheese-3",
        },
        4: {
          spriteId: "cheese-4",
        },
        5: {
          spriteId: "cheese-5",
        },
      },
    });

  const baconY =
    2 -
    Math.max(0, meatCount - 1) *
      10 -
    Math.max(0, cheeseCount - 1) *
      5;

  let baconLayers: Layer[] = [];

  if (baconCount === 1) {
    baconLayers = [
      {
        key: "bacon-1",
        spriteId: "bacon-1",
        active: true,
        y: baconY,
        z: 52,
        scale: 0.92,
      },
    ];
  } else if (baconCount === 2) {
    baconLayers = [
      {
        key: "bacon-2",
        spriteId: "bacon-2",
        active: true,
        y: baconY,
        z: 52,
        scale: 0.92,
      },
    ];
  } else if (baconCount === 4) {
    baconLayers = [
      {
        key: "bacon-4",
        spriteId: "bacon-4",
        active: true,
        y: baconY,
        z: 52,
        scale: 0.92,
      },
    ];
  } else if (baconCount > 0) {
    baconLayers = repeatedLayers({
      key: "bacon",
      asset: {
        spriteId: "bacon-1",
      },
      count: baconCount,
      y: baconY,
      step: 10,
      z: 52,
      scale: 0.92,
    });
  }

  const lettuceLayers =
    countAssetLayer({
      key: "lettuce",
      count: lettuceCount,
      y:
        -118 -
        Math.round(
          upperLift * 0.2,
        ),
      z: 79,
      fallbackStep: 10,
      scale: 1.02,
      assets: {
        1: {
          src:
            `${ASSET_ROOT}/lechuga.svg`,
        },
        2: {
          spriteId: "lettuce-2",
        },
        3: {
          spriteId: "lettuce-3",
        },
        4: {
          spriteId: "lettuce-4",
        },
        5: {
          spriteId: "lettuce-5",
        },
      },
    });

  const baseSauce = sauceAsset(
    ketchupSelected,
    mustardSelected,
    mayonnaiseSelected,
  );

  const layers: Layer[] = [
    {
      key: "bottom-bun",
      src:
        `${ASSET_ROOT}/panabajo.svg`,
      active: true,
      y: 150,
      z: 10,
    },
    ...(baseSauce
      ? [
          {
            key: "base-sauces",
            ...baseSauce,
            active: true,
            y: 116,
            z: 20,
            scale: 0.72,
          } satisfies Layer,
        ]
      : []),
    ...(chipotleSelected
      ? [
          {
            key: "chipotle",
            spriteId: "chipotle",
            active: true,
            y: 108,
            z: 22,
            scale: 0.69,
            x: -4,
          } satisfies Layer,
        ]
      : []),
    ...(bbqChipotleSelected
      ? [
          {
            key: "bbq-chipotle",
            spriteId: "bbq-chipotle",
            active: true,
            y: 101,
            z: 24,
            scale: 0.68,
            x: 5,
          } satisfies Layer,
        ]
      : []),
    ...meatLayers,
    ...cheeseLayers,
    ...baconLayers,
    ...repeatedLayers({
      key: "white-onion",
      asset: {
        src:
          `${ASSET_ROOT}/cebolla.svg`,
      },
      count: whiteOnionCount,
      y:
        -49 -
        Math.round(
          upperLift * 0.12,
        ),
      step: 9,
      z: 62,
      scale: 0.9,
    }),
    ...repeatedLayers({
      key: "caramelized-onion",
      asset: {
        src:
          `${ASSET_ROOT}/cebollaacaramelizada.svg`,
      },
      count:
        caramelizedOnionCount,
      y:
        -70 -
        Math.round(
          upperLift * 0.14,
        ),
      step: 8,
      z: 67,
      scale: 0.86,
    }),
    ...repeatedLayers({
      key: "pickles",
      asset: {
        spriteId: "pickles",
      },
      count: picklesCount,
      y:
        -82 -
        Math.round(
          upperLift * 0.15,
        ),
      step: 8,
      z: 70,
      scale: 0.82,
    }),
    ...repeatedLayers({
      key: "tomato",
      asset: {
        src:
          `${ASSET_ROOT}/tomate.svg`,
      },
      count: tomatoCount,
      y:
        -96 -
        Math.round(
          upperLift * 0.18,
        ),
      step: 9,
      z: 74,
      scale: 0.94,
    }),
    ...lettuceLayers,
    {
      key: "top-bun",
      src:
        `${ASSET_ROOT}/panarriba.svg`,
      active: true,
      y:
        -158 -
        Math.round(
          upperLift * 0.5,
        ),
      z: 92,
    },
  ];

  return (
    <div className="burger-preview-wrap">
      <div className="burger-preview-head">
        <div>
          <span>
            Vista previa en vivo
          </span>
          <strong>
            Se arma mientras eliges
          </strong>
        </div>
        <span className="burger-preview-live">
          En vivo
        </span>
      </div>

      <div
        className="burger-preview"
        role="img"
        aria-label={`Vista previa de ${label}`}
        data-testid="burger-preview"
      >
        <div className="burger-preview-glow" />

        {layers.map((layer) => {
          const style: LayerStyle = {
            "--burger-y":
              `${layer.y}px`,
            "--burger-scale":
              String(
                layer.scale ?? 1,
              ),
            "--burger-x":
              `${layer.x ?? 0}px`,
            zIndex: layer.z,
          };

          const className =
            layer.active
              ? "burger-preview-layer is-active"
              : "burger-preview-layer";

          if (layer.spriteId) {
            return (
              <svg
                aria-hidden="true"
                className={className}
                data-preview-layer={
                  layer.key
                }
                key={layer.key}
                style={style}
                viewBox="0 0 512 512"
              >
                <use
                  href={`${SPRITE_PATH}#${layer.spriteId}`}
                />
              </svg>
            );
          }

          return (
            <img
              aria-hidden="true"
              alt=""
              className={className}
              data-preview-layer={
                layer.key
              }
              key={layer.key}
              src={layer.src}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}
