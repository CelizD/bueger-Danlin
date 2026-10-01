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
import type {
  CreateStaffForm,
  StaffUser,
} from "../personal/types";
import { StaffCreateForm } from "./staff-create-form";
import { StaffUserList } from "./staff-user-list";

afterEach(() => {
  cleanup();
});

const EMPTY_FORM: CreateStaffForm = {
  name: "",
  email: "",
  role: "KITCHEN",
  password: "",
};

function CreateHarness({
  onSubmit,
}: {
  onSubmit: (form: CreateStaffForm) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <StaffCreateForm
      form={form}
      creating={false}
      onChange={(field, value) => {
        setForm((current) => ({
          ...current,
          [field]: value,
        }));
      }}
      onClose={vi.fn()}
      onSubmit={submit}
    />
  );
}

const users: StaffUser[] = [
  {
    id: "self-id",
    name: "Admin Principal",
    email: "admin@example.test",
    role: "ADMIN",
    active: true,
    mfaEnabled: true,
    mfaEnrolledAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "kitchen-id",
    name: "Persona Cocina",
    email: "cocina@example.test",
    role: "KITCHEN",
    active: true,
    mfaEnabled: false,
    mfaEnrolledAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
];

describe("staff forms", () => {
  it("crea el payload de una cuenta desde interacción real", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CreateHarness onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText("Nombre"),
      "Repartidor Prueba",
    );
    await user.type(
      screen.getByLabelText("Correo"),
      "repartidor@example.test",
    );
    await user.selectOptions(
      screen.getByLabelText("Rol"),
      "DELIVERY",
    );
    await user.type(
      screen.getByLabelText("Contraseña temporal"),
      "Temporal-Segura-2026!",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Crear cuenta",
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Repartidor Prueba",
      email: "repartidor@example.test",
      role: "DELIVERY",
      password: "Temporal-Segura-2026!",
    });
  });

  it("impide que el usuario cambie su propio rol o se desactive", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <StaffUserList
        users={users}
        sessionUser={{
          sub: "self-id",
          name: "Admin Principal",
          email: "admin@example.test",
          role: "ADMIN",
        }}
        busyId={null}
        onUpdate={onUpdate}
        onResetMfa={vi.fn()}
        onPassword={vi.fn()}
      />,
    );

    const selfRole = screen.getByLabelText(
      "Rol de Admin Principal",
    ) as HTMLSelectElement;

    expect(selfRole.disabled).toBe(true);

    const selfCard = selfRole.closest(".staff-card");
    const selfToggle = selfCard?.querySelector(
      ".staff-toggle-button",
    ) as HTMLButtonElement;

    expect(selfToggle.disabled).toBe(true);

    await user.selectOptions(
      screen.getByLabelText("Rol de Persona Cocina"),
      "DELIVERY",
    );

    expect(onUpdate).toHaveBeenCalledWith(
      users[1],
      { role: "DELIVERY" },
    );
  });
});
