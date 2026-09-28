import {
  describe,
  expect,
  it,
} from "vitest";
import { dashboardBarWidth } from "./formatters";

describe("dashboardBarWidth", () => {
  it("mantiene un mínimo visual de 5%", () => {
    expect(
      dashboardBarWidth(1, 100),
    ).toBe(5);
  });

  it("calcula el porcentaje normal", () => {
    expect(
      dashboardBarWidth(50, 100),
    ).toBe(50);
  });

  it("maneja valores vacíos sin dividir entre cero", () => {
    expect(
      dashboardBarWidth(0, 0),
    ).toBe(5);
  });
});
