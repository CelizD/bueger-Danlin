import {
  lettuceVisualProfile,
} from "./burger-preview-lettuce";
import { describe, expect, it } from "vitest";

describe("lettuce preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [0, 1, 2, 3, 4, 5]) {
      expect(
        lettuceVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("reduce gradualmente la escala para cantidades altas", () => {
    const scales = [1, 2, 3, 4, 5].map(
      (count) =>
        lettuceVisualProfile(count).scale,
    );

    expect(scales).toEqual([
      0.96,
      0.94,
      0.92,
      0.9,
      0.88,
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

  it("mantiene la lechuga pegada al resto del stack", () => {
    expect(
      lettuceVisualProfile(1).yOffset,
    ).toBe(3);
    expect(
      lettuceVisualProfile(5).yOffset,
    ).toBe(-5);
  });

  it("normaliza cantidades fuera del rango cero a cinco", () => {
    expect(
      lettuceVisualProfile(-10),
    ).toEqual(
      lettuceVisualProfile(0),
    );
    expect(
      lettuceVisualProfile(99),
    ).toEqual(
      lettuceVisualProfile(5),
    );
  });
});
