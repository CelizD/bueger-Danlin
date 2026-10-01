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
  vi,
} from "vitest";
import type { SaturdayFormState } from "../saturdays/types";
import { SaturdayEventForm } from "./saturday-event-form";

afterEach(() => {
  cleanup();
});

const FORM: SaturdayFormState = {
  locationLabel: "Universidad",
  locationAddress: "Av. Universidad 123, Tijuana",
  latitude: "32.5149",
  longitude: "-117.0382",
  freeDeliveryMinPaidCombos: "5",
  transportCostMx: "150",
  pickupDate: "2026-10-10",
  pickupTime: "13:00",
  closeDate: "2026-10-10",
  closeTime: "11:00",
  maxCombos: "20",
};

function Harness({
  locked = false,
}: {
  locked?: boolean;
}) {
  const [form, setForm] = useState(FORM);

  return (
    <SaturdayEventForm
      editing={false}
      form={form}
      saving={false}
      deliveryTermsLocked={locked}
      onChange={(field, value) => {
        setForm((current) => ({
          ...current,
          [field]: value,
        }));
      }}
      onClose={vi.fn()}
      onSubmit={(event) => {
        event.preventDefault();
      }}
    />
  );
}

describe("SaturdayEventForm", () => {
  it("mantiene la meta de envío gratis dentro del límite de combos", async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const maxCombos = screen.getByLabelText(
      "Límite de combos",
    ) as HTMLInputElement;
    const target = screen.getByLabelText(
      "Meta para envío gratis",
    ) as HTMLInputElement;

    expect(maxCombos.min).toBe("5");
    expect(target.max).toBe("20");

    await user.clear(maxCombos);
    await user.type(maxCombos, "8");

    expect(target.max).toBe("8");

    await user.clear(target);
    await user.type(target, "6");

    expect(maxCombos.min).toBe("6");
  });

  it("bloquea meta y costo cuando la entrega ya tiene pedidos", () => {
    render(<Harness locked />);

    expect(
      (
        screen.getByLabelText(
          "Meta para envío gratis",
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByLabelText(
          "Costo de traslado (MXN)",
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        /están bloqueados porque esta entrega ya tiene pedidos/i,
      ),
    ).toBeTruthy();
  });
});
