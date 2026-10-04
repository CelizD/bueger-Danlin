import {
  meatVisualProfile,
} from "./burger-preview-meat";
import { describe, expect, it } from "vitest";

describe("meat preview visual profiles", () => {
  it("mantiene todas las cantidades centradas", () => {
    for (const count of [1, 2, 3, 4, 5]) {
      expect(
        meatVisualProfile(count).x,
      ).toBe(0);
    }
  });

  it("reduce gradualmente la escala para cantidades altas", () => {
    const scales = [1, 2, 3, 4, 5].map(
      (count) =>
        meatVisualProfile(count).scale,
    );

    expect(scales).toEqual([
      0.92,
      0.91,
      0.89,
      0.87,
      0.85,
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

  it("sube ligeramente las composiciones altas para no invadir el pan inferior", () => {
    expect(
      meatVisualProfile(1).yOffset,
    ).toBe(0);
    expect(
      meatVisualProfile(5).yOffset,
    ).toBe(-8);
  });

  it("normaliza cantidades fuera del rango 1 a 5", () => {
    expect(
      meatVisualProfile(0),
    ).toEqual(
      meatVisualProfile(1),
    );
    expect(
      meatVisualProfile(99),
    ).toEqual(
      meatVisualProfile(5),
    );
  });
});
