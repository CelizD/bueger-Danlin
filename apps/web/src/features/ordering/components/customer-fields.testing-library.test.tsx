// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import { CustomerFields } from "./customer-fields";

afterEach(() => {
  cleanup();
});

function CustomerFieldsHarness() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  return (
    <CustomerFields
      privacy={{
        responsible: "Burger Danlin",
        address: "Tijuana, Baja California",
        email: "privacidad@example.test",
        configured: true,
      }}
      name={name}
      phone={phone}
      email={email}
      onNameChange={setName}
      onPhoneChange={setPhone}
      onEmailChange={setEmail}
    />
  );
}

describe("CustomerFields", () => {
  it("actualiza datos como lo haría el cliente y normaliza el teléfono", async () => {
    const user = userEvent.setup();

    render(<CustomerFieldsHarness />);

    const name = screen.getByLabelText("Nombre *");
    const phone = screen.getByRole("textbox", {
      name: /Teléfono/,
    });
    const email = screen.getByLabelText("Correo (opcional)");

    await user.type(name, "Daniel Celiz");
    await user.type(phone, "664-12a34 567");
    await user.type(email, "daniel@example.test");

    expect((name as HTMLInputElement).value).toBe("Daniel Celiz");
    expect((phone as HTMLInputElement).value).toBe("6641234567");
    expect((email as HTMLInputElement).value).toBe(
      "daniel@example.test",
    );
    expect(name.getAttribute("autocomplete")).toBe("name");
    expect(phone.getAttribute("autocomplete")).toBe("tel-national");
    expect(email.getAttribute("autocomplete")).toBe("email");
  });

  it("mantiene visibles las rutas de privacidad y ARCO", () => {
    render(<CustomerFieldsHarness />);

    expect(
      screen.getByRole("complementary", {
        name: "Aviso de privacidad simplificado",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "formulario público ARCO",
      }).getAttribute("href"),
    ).toBe("/arco");
    expect(
      screen.getByRole("link", {
        name: "Aviso de Privacidad integral",
      }).getAttribute("href"),
    ).toBe("/privacidad");
  });
});
