import {
  baconVisualProfile,
} from "./burger-preview-bacon";
import { describe, expect, it } from "vitest";

describe("bacon preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(
        baconVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("usa los SVG exactos cuando existen", () => {
    expect(
      baconVisualProfile(1)
        .exactSpriteId,
    ).toBe("bacon-1");
    expect(
      baconVisualProfile(2)
        .exactSpriteId,
    ).toBe("bacon-2");
    expect(
      baconVisualProfile(4)
        .exactSpriteId,
    ).toBe("bacon-4");
  });

  it("repite el tocino sencillo para tres y cinco porciones", () => {
    expect(
      baconVisualProfile(3)
        .repeatSingleCount,
    ).toBe(3);
    expect(
      baconVisualProfile(5)
        .repeatSingleCount,
    ).toBe(5);
  });

  it("no crea capas cuando la cantidad es cero", () => {
    const profile =
      baconVisualProfile(0);

    expect(
      profile.repeatSingleCount,
    ).toBe(0);
    expect(
      profile.exactSpriteId,
    ).toBeUndefined();
  });

  it("reduce gradualmente la escala en cantidades altas", () => {
    expect(
      baconVisualProfile(1).scale,
    ).toBeGreaterThan(
      baconVisualProfile(5).scale,
    );
  });

  it("normaliza cantidades fuera del rango cero a cinco", () => {
    expect(
      baconVisualProfile(-10),
    ).toEqual(
      baconVisualProfile(0),
    );
    expect(
      baconVisualProfile(99),
    ).toEqual(
      baconVisualProfile(5),
    );
  });
});
