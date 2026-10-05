import {
  caramelizedOnionVisualProfile,
} from "./burger-preview-caramelized-onion";
import { describe, expect, it } from "vitest";

describe("caramelized onion preview visual profile", () => {
  it("mantiene la capa centrada", () => {
    expect(
      caramelizedOnionVisualProfile(1)
        .x,
    ).toBe(0);
  });

  it("usa una escala compacta para no sobresalir", () => {
    expect(
      caramelizedOnionVisualProfile(1)
        .scale,
    ).toBe(0.8);
  });

  it("mantiene apagado y encendido con perfiles estables", () => {
    expect(
      caramelizedOnionVisualProfile(0),
    ).toEqual({
      scale: 0.8,
      x: 0,
      yOffset: 0,
    });
    expect(
      caramelizedOnionVisualProfile(1),
    ).toEqual({
      scale: 0.8,
      x: 0,
      yOffset: 2,
    });
  });
});
