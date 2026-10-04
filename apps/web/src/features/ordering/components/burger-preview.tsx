import {
  burgerModifierQuantity,
} from "@/features/ordering/modifier-quantities";
import type { CSSProperties } from "react";
import { calculateBurgerStackLayout } from "./burger-preview-layout";
import { meatVisualProfile } from "./burger-preview-meat";
import { cheeseVisualProfile } from "./burger-preview-cheese";
import { baconVisualProfile } from "./burger-preview-bacon";
import { lettuceVisualProfile } from "./burger-preview-lettuce";
import { tomatoVisualProfile } from "./burger-preview-tomato";
import { whiteOnionVisualProfile } from "./burger-preview-white-onion";
import { picklesVisualProfile } from "./burger-preview-pickles";
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

  const baseSauce = sauceAsset(
    ketchupSelected,
    mustardSelected,
    mayonnaiseSelected,
  );

  const hasSauce =
    Boolean(baseSauce) ||
    chipotleSelected ||
    bbqChipotleSelected;

  const {
    sauceY,
    meatY,
    cheeseY,
    baconY,
    caramelizedOnionY,
    whiteOnionY,
    picklesY,
    tomatoY,
    lettuceY,
    topBunY,
  } = calculateBurgerStackLayout({
    hasSauce,
    meat: meatCount,
    cheese: cheeseCount,
    bacon: baconCount,
    caramelizedOnion:
      caramelizedOnionCount,
    whiteOnion: whiteOnionCount,
    pickles: picklesCount,
    tomato: tomatoCount,
    lettuce: lettuceCount,
  });

  const meatProfile =
    meatVisualProfile(meatCount);

  const meatLayers =
    countAssetLayer({
      key: "meat",
      count: meatCount,
      y:
        meatY +
        meatProfile.yOffset,
      z: 32,
      fallbackStep: 23,
      scale: meatProfile.scale,
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
    }).map((layer) => ({
      ...layer,
      x: meatProfile.x,
    }));

  const cheeseProfile =
    cheeseVisualProfile(cheeseCount);

  const cheeseLayers =
    countAssetLayer({
      key: "cheese",
      count: cheeseCount,
      y:
        cheeseY +
        cheeseProfile.yOffset,
      z: 44,
      fallbackStep: 9,
      scale: cheeseProfile.scale,
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
    }).map((layer) => ({
      ...layer,
      x: cheeseProfile.x,
    }));

  const baconProfile =
    baconVisualProfile(baconCount);

  let baconLayers: Layer[] = [];

  if (
    baconCount > 0 &&
    baconProfile.exactSpriteId
  ) {
    baconLayers = [
      {
        key: `bacon-${baconCount}`,
        spriteId:
          baconProfile.exactSpriteId,
        active: true,
        y:
          baconY +
          baconProfile.yOffset,
        z: 52,
        scale: baconProfile.scale,
        x: baconProfile.x,
      },
    ];
  } else if (
    baconProfile.repeatSingleCount >
    0
  ) {
    baconLayers = Array.from(
      {
        length:
          baconProfile.repeatSingleCount,
      },
      (_, index): Layer => ({
        key: `bacon-${index + 1}`,
        spriteId: "bacon-1",
        active: true,
        y:
          baconY +
          baconProfile.yOffset -
          index * baconProfile.step,
        z: 52 + index,
        scale:
          baconProfile.scale -
          index * 0.01,
        x: baconProfile.x,
      }),
    );
  }

  const lettuceProfile =
    lettuceVisualProfile(lettuceCount);

  const lettuceLayers =
    countAssetLayer({
      key: "lettuce",
      count: lettuceCount,
      y:
        lettuceY +
        lettuceProfile.yOffset,
      z: 79,
      fallbackStep: 10,
      scale: lettuceProfile.scale,
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
    }).map((layer) => ({
      ...layer,
      x: lettuceProfile.x,
    }));

  const whiteOnionProfile =
    whiteOnionVisualProfile(
      whiteOnionCount,
    );

  const whiteOnionLayers =
    Array.from(
      { length: whiteOnionCount },
      (_, index): Layer => ({
        key: `white-onion-${index + 1}`,
        src:
          `${ASSET_ROOT}/cebolla.svg`,
        active: true,
        y:
          whiteOnionY +
          whiteOnionProfile.yOffset -
          index *
            whiteOnionProfile.step,
        z: 64 + index,
        scale:
          whiteOnionProfile.scale -
          index * 0.008,
        x: whiteOnionProfile.x,
      }),
    );

  const picklesProfile =
    picklesVisualProfile(picklesCount);

  const picklesLayers = Array.from(
    { length: picklesCount },
    (_, index): Layer => ({
      key: `pickles-${index + 1}`,
      spriteId: "pickles",
      active: true,
      y:
        picklesY +
        picklesProfile.yOffset -
        index * picklesProfile.step,
      z: 68 + index,
      scale:
        picklesProfile.scale -
        index * 0.006,
      x: picklesProfile.x,
    }),
  );

  const tomatoProfile =
    tomatoVisualProfile(tomatoCount);

  const tomatoLayers = Array.from(
    { length: tomatoCount },
    (_, index): Layer => ({
      key: `tomato-${index + 1}`,
      src:
        `${ASSET_ROOT}/tomate.svg`,
      active: true,
      y:
        tomatoY +
        tomatoProfile.yOffset -
        index * tomatoProfile.step,
      z: 72 + index,
      scale:
        tomatoProfile.scale -
        index * 0.008,
      x: tomatoProfile.x,
    }),
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
            y: sauceY,
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
            y: sauceY - 6,
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
            y: sauceY - 12,
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
      key: "caramelized-onion",
      asset: {
        src:
          `${ASSET_ROOT}/cebollaacaramelizada.svg`,
      },
      count:
        caramelizedOnionCount,
      y: caramelizedOnionY,
      step: 8,
      z: 60,
      scale: 0.86,
    }),
    ...whiteOnionLayers,
    ...picklesLayers,
    ...tomatoLayers,
    ...lettuceLayers,
    {
      key: "top-bun",
      src:
        `${ASSET_ROOT}/panarriba.svg`,
      active: true,
      y: topBunY,
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
                data-preview-ingredient={
                  layer.key.startsWith(
                    "meat-",
                  )
                    ? "meat"
                    : layer.key.startsWith(
                          "cheese-",
                        )
                      ? "cheese"
                      : layer.key.startsWith(
                            "bacon-",
                          )
                        ? "bacon"
                        : layer.key.startsWith(
                              "lettuce-",
                            )
                          ? "lettuce"
                          : layer.key.startsWith(
                                "tomato-",
                              )
                            ? "tomato"
                            : layer.key.startsWith(
                                  "white-onion-",
                                )
                              ? "white-onion"
                              : layer.key.startsWith(
                                    "pickles-",
                                  )
                                ? "pickles"
                                : undefined
                }
                key={layer.key}
                style={style}
                viewBox="0 0 512 512"
              >
                <use
                  href={`${SPRITE_PATH}#${layer.spriteId}`}
                  width="100%"
                  height="100%"
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
              data-preview-ingredient={
                layer.key.startsWith(
                  "meat-",
                )
                  ? "meat"
                  : layer.key.startsWith(
                        "cheese-",
                      )
                    ? "cheese"
                    : layer.key.startsWith(
                          "bacon-",
                        )
                      ? "bacon"
                      : layer.key.startsWith(
                            "lettuce-",
                          )
                        ? "lettuce"
                        : layer.key.startsWith(
                              "tomato-",
                            )
                          ? "tomato"
                          : layer.key.startsWith(
                                "white-onion-",
                              )
                            ? "white-onion"
                            : layer.key.startsWith(
                                  "pickles-",
                                )
                              ? "pickles"
                              : undefined
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
