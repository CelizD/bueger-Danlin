import {
  picklesVisualProfile,
} from "./burger-preview-pickles";
import { describe, expect, it } from "vitest";

describe("pickles preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(
        picklesVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("usa una separación vertical más compacta que tomate y cebolla", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      expect(
        picklesVisualProfile(count).step,
      ).toBe(4);
    }
  });

  it("reduce gradualmente la escala en cantidades altas", () => {
    const scales = [1, 2, 3, 4, 5].map(
      (count) =>
        picklesVisualProfile(count).scale,
    );

    expect(scales).toEqual([
      0.74,
      0.73,
      0.72,
      0.7,
      0.68,
    ]);

    for (
      let index = 1;
      index < scales.length;
      index += 1
    ) {
      expect(
        scales[index]!,
      ).toBeLessThanOrEqual(
        scales[index - 1]!,
      );
    }
  });

  it("normaliza cantidades fuera del rango cero a cinco", () => {
    expect(
      picklesVisualProfile(-10),
    ).toEqual(
      picklesVisualProfile(0),
    );
    expect(
      picklesVisualProfile(99),
    ).toEqual(
      picklesVisualProfile(5),
    );
  });
});
