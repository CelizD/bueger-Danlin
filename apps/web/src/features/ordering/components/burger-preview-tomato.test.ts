import {
  tomatoVisualProfile,
} from "./burger-preview-tomato";
import { describe, expect, it } from "vitest";

describe("tomato preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(
        tomatoVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("usa separación vertical compacta para todas las porciones", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      expect(
        tomatoVisualProfile(count).step,
      ).toBe(7);
    }
  });

  it("reduce gradualmente la escala en cantidades altas", () => {
    const scales = [1, 2, 3, 4, 5].map(
      (count) =>
        tomatoVisualProfile(count).scale,
    );

    expect(scales).toEqual([
      0.88,
      0.87,
      0.86,
      0.84,
      0.82,
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
      tomatoVisualProfile(-10),
    ).toEqual(
      tomatoVisualProfile(0),
    );
    expect(
      tomatoVisualProfile(99),
    ).toEqual(
      tomatoVisualProfile(5),
    );
  });
});
