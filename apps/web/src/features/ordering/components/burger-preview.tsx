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

export function BurgerPreview({
  burger,
  removableOptions,
  extraOptions,
  label,
}: BurgerPreviewProps) {
  const included = (key: string) => {
    const option = optionByKey(
      removableOptions,
      key,
    );

    return Boolean(
      option &&
        !burger.removedIds.includes(
          option.id,
        ),
    );
  };

  const extra = (key: string) => {
    const option = optionByKey(
      extraOptions,
      key,
    );

    return Boolean(
      option &&
        burger.extraIds.includes(
          option.id,
        ),
    );
  };

  const extraMeat = extra("extra-meat");
  const cheeseCount =
    Number(included("included-cheese")) +
    Number(extra("extra-cheese"));
  const baconCount =
    Number(included("included-bacon")) +
    Number(extra("extra-bacon"));
  const ketchup = included(
    "included-ketchup",
  );
  const mustard = included(
    "included-mustard",
  );

  const layers: Layer[] = [
    {
      key: "bottom-bun",
      src: `${ASSET_ROOT}/panabajo.svg`,
      active: true,
      y: 150,
      z: 10,
    },
    {
      key: "ketchup-mustard",
      src: `${ASSET_ROOT}/ketchupmostaza.svg`,
      active: ketchup && mustard,
      y: 118,
      z: 20,
      scale: 0.72,
    },
    {
      key: "ketchup",
      src: `${ASSET_ROOT}/ketchup.svg`,
      active: ketchup && !mustard,
      y: 118,
      z: 20,
      scale: 0.68,
    },
    {
      key: "mustard",
      src: `${ASSET_ROOT}/mostasa.svg`,
      active: mustard && !ketchup,
      y: 118,
      z: 20,
      scale: 0.68,
    },
    {
      key: "meat",
      src: `${ASSET_ROOT}/carne.svg`,
      active: !extraMeat,
      y: 82,
      z: 30,
    },
    {
      key: "double-meat",
      src: `${ASSET_ROOT}/doblecarne.svg`,
      active: extraMeat,
      y: 80,
      z: 30,
    },
    {
      key: "cheese",
      src: `${ASSET_ROOT}/queso.svg`,
      active: cheeseCount === 1,
      y: 42,
      z: 40,
    },
    {
      key: "double-cheese",
      src: `${ASSET_ROOT}/doblequeso.svg`,
      active: cheeseCount >= 2,
      y: 42,
      z: 40,
    },
    {
      key: "bacon",
      src: `${ASSET_ROOT}/dobletocino.svg`,
      active: baconCount >= 1,
      y: 3,
      z: 50,
      scale: 0.92,
    },
    {
      key: "extra-bacon",
      src: `${ASSET_ROOT}/dobletocino.svg`,
      active: baconCount >= 2,
      y: -17,
      z: 51,
      scale: 0.82,
      x: 7,
    },
    {
      key: "white-onion",
      src: `${ASSET_ROOT}/cebolla.svg`,
      active: included(
        "included-white-onion",
      ),
      y: -48,
      z: 60,
      scale: 0.9,
    },
    {
      key: "caramelized-onion",
      src: `${ASSET_ROOT}/cebollaacaramelizada.svg`,
      active: included(
        "included-caramelized-onion",
      ),
      y: -75,
      z: 61,
      scale: 0.86,
    },
    {
      key: "tomato",
      src: `${ASSET_ROOT}/tomate.svg`,
      active: included(
        "included-tomato",
      ),
      y: -88,
      z: 65,
      scale: 0.94,
    },
    {
      key: "lettuce",
      src: `${ASSET_ROOT}/lechuga.svg`,
      active: included(
        "included-lettuce",
      ),
      y: -112,
      z: 70,
      scale: 1.02,
    },
    {
      key: "top-bun",
      src: `${ASSET_ROOT}/panarriba.svg`,
      active: true,
      y: -150,
      z: 80,
    },
  ];

  return (
    <div className="burger-preview-wrap">
      <div className="burger-preview-head">
        <div>
          <span>Vista previa en vivo</span>
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
            "--burger-y": `${layer.y}px`,
            "--burger-scale": String(
              layer.scale ?? 1,
            ),
            "--burger-x": `${layer.x ?? 0}px`,
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
