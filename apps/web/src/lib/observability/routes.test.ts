import { describe, expect, it } from "vitest";
import { normalizeTelemetryRoute } from "./routes";

describe("normalizeTelemetryRoute", () => {
  it("elimina el código de pedido de la etiqueta RUM", () => {
    expect(
      normalizeTelemetryRoute("/pedido/H-ABC123"),
    ).toBe("/pedido/[orderCode]");
  });

  it("conserva rutas operativas sin identificadores", () => {
    expect(
      normalizeTelemetryRoute("/admin/cocina"),
    ).toBe("/admin/cocina");
  });

  it("normaliza la raíz", () => {
    expect(normalizeTelemetryRoute("")).toBe("/");
  });
});
