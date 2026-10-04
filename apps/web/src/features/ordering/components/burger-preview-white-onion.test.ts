import {
  whiteOnionVisualProfile,
} from "./burger-preview-white-onion";
import { describe, expect, it } from "vitest";

describe("white onion preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(
        whiteOnionVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("usa separación vertical compacta para todas las porciones", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      expect(
        whiteOnionVisualProfile(count).step,
      ).toBe(6);
    }
  });

  it("reduce gradualmente la escala en cantidades altas", () => {
    const scales = [1, 2, 3, 4, 5].map(
      (count) =>
        whiteOnionVisualProfile(
          count,
        ).scale,
    );

    expect(scales).toEqual([
      0.82,
      0.81,
      0.8,
      0.78,
      0.76,
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
      whiteOnionVisualProfile(-10),
    ).toEqual(
      whiteOnionVisualProfile(0),
    );
    expect(
      whiteOnionVisualProfile(99),
    ).toEqual(
      whiteOnionVisualProfile(5),
    );
  });
});
