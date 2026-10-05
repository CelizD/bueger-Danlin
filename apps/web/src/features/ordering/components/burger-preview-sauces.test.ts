import {
  baseSauceSpriteId,
  buildSauceVisualLayers,
} from "./burger-preview-sauces";
import { describe, expect, it } from "vitest";

describe("burger preview sauces", () => {
  it.each([
    [
      {
        ketchup: false,
        mustard: false,
        mayonnaise: false,
      },
      null,
    ],
    [
      {
        ketchup: true,
        mustard: false,
        mayonnaise: false,
      },
      "ketchup",
    ],
    [
      {
        ketchup: false,
        mustard: true,
        mayonnaise: false,
      },
      "mustard",
    ],
    [
      {
        ketchup: false,
        mustard: false,
        mayonnaise: true,
      },
      "mayonnaise",
    ],
    [
      {
        ketchup: true,
        mustard: true,
        mayonnaise: false,
      },
      "ketchup-mustard",
    ],
    [
      {
        ketchup: true,
        mustard: false,
        mayonnaise: true,
      },
      "ketchup-mayonnaise",
    ],
    [
      {
        ketchup: false,
        mustard: true,
        mayonnaise: true,
      },
      "mustard-mayonnaise",
    ],
    [
      {
        ketchup: true,
        mustard: true,
        mayonnaise: true,
      },
      "ketchup-mustard-mayonnaise",
    ],
  ])(
    "usa el SVG combinado correcto",
    (selection, expected) => {
      expect(
        baseSauceSpriteId(selection),
      ).toBe(expected);
    },
  );

  it("no crea capas cuando no hay ninguna salsa", () => {
    expect(
      buildSauceVisualLayers(
        {
          ketchup: false,
          mustard: false,
          mayonnaise: false,
          chipotle: false,
          bbqChipotle: false,
        },
        116,
      ),
    ).toEqual([]);
  });

  it("mantiene todas las salsas centradas y dentro de una franja delgada", () => {
    const layers =
      buildSauceVisualLayers(
        {
          ketchup: true,
          mustard: true,
          mayonnaise: true,
          chipotle: true,
          bbqChipotle: true,
        },
        116,
      );

    expect(layers).toHaveLength(3);
    expect(
      layers.map(
        (layer) => layer.spriteId,
      ),
    ).toEqual([
      "ketchup-mustard-mayonnaise",
      "chipotle",
      "bbq-chipotle",
    ]);
    expect(
      layers.map((layer) => layer.x),
    ).toEqual([0, 0, 0]);
    expect(
      Math.max(
        ...layers.map(
          (layer) => layer.y,
        ),
      ) -
        Math.min(
          ...layers.map(
            (layer) => layer.y,
          ),
        ),
    ).toBe(6);
  });

  it("no aumenta la cantidad de capas base aunque haya tres salsas clásicas", () => {
    const layers =
      buildSauceVisualLayers(
        {
          ketchup: true,
          mustard: true,
          mayonnaise: true,
          chipotle: false,
          bbqChipotle: false,
        },
        116,
      );

    expect(layers).toHaveLength(1);
    expect(layers[0]?.spriteId).toBe(
      "ketchup-mustard-mayonnaise",
    );
  });
});
