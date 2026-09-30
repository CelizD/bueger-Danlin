import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BurgerBuilder } from "./burger-builder";
import { CustomerFields } from "./customer-fields";
import { DrinkSelector } from "./drink-selector";
import { PickupPointSelector } from "./pickup-point-selector";
import { PurchaseTermsConsent } from "./purchase-terms-consent";
import type {
  InventoryAvailability,
  ModifierOption,
  PickupEvent,
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


const pickupEvents: PickupEvent[] = [
  {
    id: "event-universidad",
    code: "SAT-UNIVERSIDAD",
    name: "Universidad",
    locationLabel: "Universidad",
    pickupPoint: {
      id: "point-universidad",
      code: "UNIVERSIDAD",
      name: "Universidad",
      address: "Entrada principal",
      latitude: 32.5149,
      longitude: -117.0382,
    },
    timezone: "America/Tijuana",
    startsAt: "2026-10-03T17:00:00.000Z",
    closesAt: "2026-10-03T04:00:00.000Z",
    maxCombos: 50,
    reservedCombos: 3,
    remainingCombos: 47,
    status: "OPEN",
    groupDelivery: {
      minPaidCombos: 5,
      paidComboCount: 3,
      remainingPaidCombos: 2,
      transportCostCents: 10000,
      estimatedDeliveryFeeCents: 3334,
      freeDeliveryUnlocked: false,
    },
  },
  {
    id: "event-cucapa",
    code: "SAT-CUCAPA",
    name: "Cucapá",
    locationLabel: "Cucapá",
    pickupPoint: {
      id: "point-cucapa",
      code: "CUCAPA",
      name: "Cucapá",
      address: "Punto Cucapá",
      latitude: 32.4906,
      longitude: -116.9369,
    },
    timezone: "America/Tijuana",
    startsAt: "2026-10-03T19:00:00.000Z",
    closesAt: "2026-10-03T04:00:00.000Z",
    maxCombos: 50,
    reservedCombos: 5,
    remainingCombos: 45,
    status: "OPEN",
    groupDelivery: {
      minPaidCombos: 5,
      paidComboCount: 5,
      remainingPaidCombos: 0,
      transportCostCents: 10000,
      estimatedDeliveryFeeCents: 0,
      freeDeliveryUnlocked: true,
    },
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
        privacy={{
          responsible: "Burger Danlin",
          address: "Domicilio de prueba",
          email: "privacidad@example.test",
          configured: true,
        }}
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
    expect(html).toContain("Aviso de privacidad simplificado");
    expect(html).toContain("/privacidad");
    expect(html).toContain("privacidad@example.test");
  });

  it("muestra aceptación explícita de términos de compra", () => {
    const html = renderToStaticMarkup(
      <PurchaseTermsConsent
        checked={false}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain(
      "Términos y Condiciones",
    );
    expect(html).toContain(
      "política de cancelación y reembolso",
    );
    expect(html).toContain(
      'href="/terminos"',
    );
    expect(html).toContain(
      'required=""',
    );
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

  it("muestra puntos, progreso grupal y envío gratis", () => {
    const html = renderToStaticMarkup(
      <PickupPointSelector
        events={pickupEvents}
        selectedEventId="event-universidad"
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("Universidad");
    expect(html).toContain("Cucapá");
    expect(html).toContain("3 de 5 combos pagados");
    expect(html).toContain("Envío gratis desbloqueado");
    expect(html).toContain("Punto seleccionado");
    expect(html).toContain("Abrir ubicación exacta");
    expect(html).toContain("google.com/maps/search");
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
