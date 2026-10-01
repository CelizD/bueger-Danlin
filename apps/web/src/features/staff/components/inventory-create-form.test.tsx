// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  useState,
  type FormEvent,
} from "react";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { CreateInventoryForm } from "../inventory/types";
import { InventoryCreateForm } from "./inventory-create-form";

afterEach(() => {
  cleanup();
});

const EMPTY_FORM: CreateInventoryForm = {
  name: "",
  unit: "",
  stock: "0",
  threshold: "0",
};

function Harness({
  creating = false,
  onSubmit = vi.fn(),
  onClose = vi.fn(),
}: {
  creating?: boolean;
  onSubmit?: (form: CreateInventoryForm) => void;
  onClose?: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <InventoryCreateForm
      form={form}
      creating={creating}
      onChange={(field, value) => {
        setForm((current) => ({
          ...current,
          [field]: value,
        }));
      }}
      onClose={onClose}
      onSubmit={submit}
    />
  );
}

describe("InventoryCreateForm", () => {
  it("captura los valores y entrega el formulario actual al enviar", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<Harness onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText("Nombre"),
      "Pan brioche",
    );
    await user.type(
      screen.getByLabelText("Unidad"),
      "pieza",
    );

    const stock = screen.getByLabelText("Stock inicial");
    const threshold = screen.getByLabelText(
      "Alerta de stock bajo",
    );

    await user.clear(stock);
    await user.type(stock, "40");
    await user.clear(threshold);
    await user.type(threshold, "8");

    await user.click(
      screen.getByRole("button", {
        name: "Agregar artículo",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Pan brioche",
      unit: "pieza",
      stock: "40",
      threshold: "8",
    });
  });

  it("deshabilita el envío mientras se está creando y permite cerrar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Harness
        creating
        onClose={onClose}
      />,
    );

    const submit = screen.getByRole("button", {
      name: "Creando…",
    });

    expect(
      (submit as HTMLButtonElement).disabled,
    ).toBe(true);

    await user.click(
      screen.getByRole("button", {
        name: "Cerrar",
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
