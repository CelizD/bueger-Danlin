// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Alert } from "./alert";
import { Button } from "./button";
import { LoadingState } from "./loading-state";
import { TextField } from "./text-field";

afterEach(() => {
  cleanup();
});

describe("design system primitives", () => {
  it("Button conserva semántica nativa y ejecuta interacción", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button onClick={onClick}>
        Guardar cambios
      </Button>,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Guardar cambios",
      }),
    );

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("TextField conecta label, hint y error accesible", () => {
    render(
      <TextField
        id="customer-name"
        label="Nombre"
        hint="Escribe tu nombre completo."
        error="El nombre es obligatorio."
      />,
    );

    const input = screen.getByLabelText(
      "Nombre",
    ) as HTMLInputElement;

    expect(input.id).toBe("customer-name");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(
      "customer-name-hint",
    );
    expect(input.getAttribute("aria-describedby")).toContain(
      "customer-name-error",
    );
    expect(
      screen.getByRole("alert").textContent,
    ).toBe("El nombre es obligatorio.");
  });

  it("Alert danger anuncia el mensaje inmediatamente", () => {
    render(
      <Alert tone="danger">
        No se pudo guardar.
      </Alert>,
    );

    expect(
      screen.getByRole("alert").textContent,
    ).toBe("No se pudo guardar.");
  });

  it("LoadingState expone un estado accesible sin depender de animación", () => {
    render(
      <LoadingState label="Cargando pedidos…" />,
    );

    expect(
      screen.getByRole("status").textContent,
    ).toContain("Cargando pedidos…");
  });
});
