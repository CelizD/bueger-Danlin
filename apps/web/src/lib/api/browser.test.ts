import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./browser";

describe("apiErrorMessage", () => {
  it("une mensajes de validación del backend", () => {
    expect(
      apiErrorMessage(
        { message: ["Nombre inválido", "Teléfono inválido"] },
        "Error",
      ),
    ).toBe("Nombre inválido Teléfono inválido");
  });

  it("conserva un mensaje simple del backend", () => {
    expect(
      apiErrorMessage(
        { message: "Pedido agotado" },
        "Error",
      ),
    ).toBe("Pedido agotado");
  });

  it("usa fallback cuando no hay un mensaje útil", () => {
    expect(
      apiErrorMessage({ message: "   " }, "No se pudo completar"),
    ).toBe("No se pudo completar");

    expect(
      apiErrorMessage(undefined, "No se pudo completar"),
    ).toBe("No se pudo completar");
  });
});
