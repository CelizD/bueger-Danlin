import {
  cheeseVisualProfile,
} from "./burger-preview-cheese";
import { describe, expect, it } from "vitest";

describe("cheese preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      expect(
        cheeseVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("reduce gradualmente la escala para cantidades altas", () => {
    const scales = [1, 2, 3, 4, 5].map(
      (count) =>
        cheeseVisualProfile(count).scale,
    );

    expect(scales).toEqual([
      0.9,
      0.89,
      0.87,
      0.85,
      0.83,
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

  it("acerca el queso a la carne sin crear un hueco extra", () => {
    expect(
      cheeseVisualProfile(1).yOffset,
    ).toBe(4);
    expect(
      cheeseVisualProfile(5).yOffset,
    ).toBe(0);
  });

  it("normaliza cantidades fuera del rango 1 a 5", () => {
    expect(
      cheeseVisualProfile(0),
    ).toEqual(
      cheeseVisualProfile(1),
    );
    expect(
      cheeseVisualProfile(99),
    ).toEqual(
      cheeseVisualProfile(5),
    );
  });
});
