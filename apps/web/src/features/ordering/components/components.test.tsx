import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BurgerBuilder } from "./burger-builder";
import { CustomerFields } from "./customer-fields";
import { DrinkSelector } from "./drink-selector";
import type {
  InventoryAvailability,
  ModifierOption,
} from "../types";

const removable: ModifierOption[] = [
  {
    id: "lettuce",
    name: "Lechuga",
    kind: "REMOVABLE",
    priceDeltaCents: 0,
    defaultSelected: true,
  },
];

const extras: ModifierOption[] = [
  {
    id: "bacon-extra",
    name: "Tocino extra",
    kind: "EXTRA",
    priceDeltaCents: 1_500,
    defaultSelected: false,
  },
];

const inventory: InventoryAvailability = {
  items: [],
  productLimits: {},
  modifierLimits: {
    lettuce: 0,
    "bacon-extra": 0,
  },
};

describe("ordering components", () => {
  it("renderiza campos de cliente con autocomplete apropiado", () => {
    const html = renderToStaticMarkup(
      <CustomerFields
        name=""
        phone=""
        email=""
        onNameChange={vi.fn()}
        onPhoneChange={vi.fn()}
        onEmailChange={vi.fn()}
      />,
    );

    expect(html).toMatch(/autocomplete="name"/i);
    expect(html).toMatch(/autocomplete="tel-national"/i);
    expect(html).toMatch(/autocomplete="email"/i);
    expect(html).toContain('type="email"');
  });

  it("muestra bebida agotada y deshabilita aumentar cantidad", () => {
    const html = renderToStaticMarkup(
      <DrinkSelector
        quantity={0}
        priceCents={3_000}
        inventoryLimit={0}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("Agotada");
    expect(html).toContain('aria-label="Agregar Coca-Cola"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-live="polite"');
  });

  it("representa ingredientes y extras agotados como controles deshabilitados", () => {
    const html = renderToStaticMarkup(
      <BurgerBuilder
        burgers={[
          {
            localId: "burger-1",
            removedIds: ["lettuce"],
            extraIds: [],
          },
        ]}
        comboPriceCents={13_000}
        removableOptions={removable}
        extraOptions={extras}
        inventory={inventory}
        maxCombosAvailable={1}
        onAddBurger={vi.fn()}
        onRemoveBurger={vi.fn()}
        onToggleRemoved={vi.fn()}
        onToggleExtra={vi.fn()}
      />,
    );

    expect(html).toContain("Lechuga · Agotado");
    expect(html).toContain("Tocino extra · Agotado");
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("deshabilita agregar combo al alcanzar la capacidad disponible", () => {
    const html = renderToStaticMarkup(
      <BurgerBuilder
        burgers={[
          {
            localId: "burger-1",
            removedIds: [],
            extraIds: [],
          },
        ]}
        comboPriceCents={13_000}
        removableOptions={[]}
        extraOptions={[]}
        inventory={null}
        maxCombosAvailable={1}
        onAddBurger={vi.fn()}
        onRemoveBurger={vi.fn()}
        onToggleRemoved={vi.fn()}
        onToggleExtra={vi.fn()}
      />,
    );

    expect(html).toContain("+ Agregar combo");
    expect(html).toContain("disabled");
  });
});
