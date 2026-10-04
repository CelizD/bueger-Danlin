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
  src: string;
  active: boolean;
  y: number;
  z: number;
  scale?: number;
  x?: number;
};

const ASSET_ROOT = "/burger-preview";

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
  src,
  count,
  y,
  step,
  z,
  scale = 1,
  x = 0,
}: {
  key: string;
  src: string;
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
      src,
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
    removableQuantity(
      "included-lettuce",
    );
  const tomatoCount =
    removableQuantity(
      "included-tomato",
    );
  const whiteOnionCount =
    removableQuantity(
      "included-white-onion",
    );
  const caramelizedOnionCount =
    removableQuantity(
      "included-caramelized-onion",
    );
  const ketchupCount =
    removableQuantity(
      "included-ketchup",
    );
  const mustardCount =
    removableQuantity(
      "included-mustard",
    );

  const sharedSauceCount =
    Math.min(
      ketchupCount,
      mustardCount,
    );

  const meatLayers =
    meatCount === 2
      ? [
          {
            key: "double-meat",
            src: `${ASSET_ROOT}/doblecarne.svg`,
            active: true,
            y: 80,
            z: 32,
          },
        ]
      : repeatedLayers({
          key: "meat",
          src: `${ASSET_ROOT}/carne.svg`,
          count: meatCount,
          y: 82,
          step: 23,
          z: 32,
        });

  const cheeseLayers =
    cheeseCount === 2
      ? [
          {
            key: "double-cheese",
            src: `${ASSET_ROOT}/doblequeso.svg`,
            active: true,
            y:
              44 -
              (meatCount - 1) *
                10,
            z: 44,
          },
        ]
      : repeatedLayers({
          key: "cheese",
          src: `${ASSET_ROOT}/queso.svg`,
          count: cheeseCount,
          y:
            44 -
            (meatCount - 1) *
              10,
          step: 9,
          z: 42,
        });

  const layers: Layer[] = [
    {
      key: "bottom-bun",
      src: `${ASSET_ROOT}/panabajo.svg`,
      active: true,
      y: 150,
      z: 10,
    },
    ...repeatedLayers({
      key: "ketchup-mustard",
      src: `${ASSET_ROOT}/ketchupmostaza.svg`,
      count: sharedSauceCount,
      y: 118,
      step: 6,
      z: 20,
      scale: 0.72,
    }),
    ...repeatedLayers({
      key: "ketchup",
      src: `${ASSET_ROOT}/ketchup.svg`,
      count:
        ketchupCount -
        sharedSauceCount,
      y:
        112 -
        sharedSauceCount * 4,
      step: 5,
      z: 24,
      scale: 0.68,
      x: -4,
    }),
    ...repeatedLayers({
      key: "mustard",
      src: `${ASSET_ROOT}/mostasa.svg`,
      count:
        mustardCount -
        sharedSauceCount,
      y:
        108 -
        sharedSauceCount * 4,
      step: 5,
      z: 27,
      scale: 0.68,
      x: 4,
    }),
    ...meatLayers,
    ...cheeseLayers,
    ...repeatedLayers({
      key: "bacon",
      src: `${ASSET_ROOT}/dobletocino.svg`,
      count: baconCount,
      y:
        2 -
        (meatCount - 1) *
          10 -
        Math.max(
          0,
          cheeseCount - 1,
        ) *
          4,
      step: 11,
      z: 52,
      scale: 0.92,
    }),
    ...repeatedLayers({
      key: "white-onion",
      src: `${ASSET_ROOT}/cebolla.svg`,
      count: whiteOnionCount,
      y: -48,
      step: 9,
      z: 62,
      scale: 0.9,
    }),
    ...repeatedLayers({
      key: "caramelized-onion",
      src: `${ASSET_ROOT}/cebollaacaramelizada.svg`,
      count:
        caramelizedOnionCount,
      y: -72,
      step: 8,
      z: 67,
      scale: 0.86,
    }),
    ...repeatedLayers({
      key: "tomato",
      src: `${ASSET_ROOT}/tomate.svg`,
      count: tomatoCount,
      y: -91,
      step: 9,
      z: 72,
      scale: 0.94,
    }),
    ...repeatedLayers({
      key: "lettuce",
      src: `${ASSET_ROOT}/lechuga.svg`,
      count: lettuceCount,
      y: -115,
      step: 10,
      z: 77,
      scale: 1.02,
    }),
    {
      key: "top-bun",
      src: `${ASSET_ROOT}/panarriba.svg`,
      active: true,
      y: -155,
      z: 90,
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

          return (
            <img
              aria-hidden="true"
              alt=""
              className={
                layer.active
                  ? "burger-preview-layer is-active"
                  : "burger-preview-layer"
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
