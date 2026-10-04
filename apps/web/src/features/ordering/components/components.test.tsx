import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BurgerBuilder } from "./burger-builder";
import { AgeAuthorizationConsent } from "./age-authorization-consent";
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
  ["lettuce", "included-lettuce", "Lechuga"],
  ["tomato", "included-tomato", "Tomate"],
  ["onion", "included-white-onion", "Cebolla"],
  ["cheese", "included-cheese", "Queso"],
  ["bacon", "included-bacon", "Tocino"],
  ["ketchup", "included-ketchup", "Ketchup"],
  ["mustard", "included-mustard", "Mostaza"],
].map(([id, key, name]) => ({
  id: String(id),
  key: String(key),
  name: String(name),
  kind: "REMOVABLE" as const,
  priceDeltaCents: 0,
  defaultSelected: true,
}));

const extras: ModifierOption[] = [
  ["meat-extra", "extra-meat", "Carne extra", 3_000],
  ["cheese-extra", "extra-cheese", "Queso extra", 1_000],
  ["bacon-extra", "extra-bacon", "Tocino extra", 1_500],
  ["lettuce-extra", "extra-lettuce", "Lechuga extra", 0],
  ["tomato-extra", "extra-tomato", "Tomate extra", 0],
  ["onion-extra", "extra-white-onion", "Cebolla extra", 0],
  ["pickles", "extra-pickles", "Pepinillos", 0],
  ["mayonnaise", "extra-mayonnaise", "Mayonesa", 0],
  ["chipotle", "extra-chipotle", "Chipotle", 0],
  ["bbq-chipotle", "extra-bbq-chipotle", "BBQ con Chipotle", 0],
].map(([id, key, name, priceDeltaCents]) => ({
  id: String(id),
  key: String(key),
  name: String(name),
  kind: "EXTRA" as const,
  priceDeltaCents: Number(priceDeltaCents),
  defaultSelected: false,
}));


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
  items: [
    {
      key: "lettuce",
      name: "Lechuga",
      unit: "porción",
      available: 0,
      lowStock: true,
      outOfStock: true,
    },
  ],
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

  it("muestra confirmación explícita para menores de edad", () => {
    const html = renderToStaticMarkup(
      <AgeAuthorizationConsent
        checked={false}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain(
      "Menores de edad",
    );
    expect(html).toContain(
      "menor de 18 años",
    );
    expect(html).toContain(
      "madre, padre o tutor",
    );
    expect(html).toContain(
      'href="/privacidad"',
    );
    expect(html).toContain(
      'required=""',
    );
  });

  it("muestra bebida agotada y deshabilita aumentar cantidad", () => {
    const html = renderToStaticMarkup(
      <DrinkSelector
        name="Coca-Cola lata"
        quantity={0}
        priceCents={3_000}
        inventoryLimit={0}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("Agotada");
    expect(html).toContain('aria-label="Agregar Coca-Cola lata"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-live="polite"');
  });

  it("muestra selectores de cantidad de 0 a 5 para ingredientes", () => {
    const html = renderToStaticMarkup(
      <BurgerBuilder
        comboName="Hamburguesa + papas"
        burgers={[
          {
            localId: "burger-1",
            removedIds: ["lettuce"],
            extraIds: [
              "pickles",
              "mayonnaise",
              "chipotle",
              "bbq-chipotle",
            ],
            modifierQuantities: {},
          },
        ]}
        comboPriceCents={13_000}
        removableOptions={removable}
        extraOptions={extras}
        inventory={inventory}
        maxCombosAvailable={1}
        onAddBurger={vi.fn()}
        onRemoveBurger={vi.fn()}
        onSetModifierQuantities={vi.fn()}
      />,
    );

    expect(html).toContain(
      "Cantidad de ingredientes",
    );
    expect(html).toContain(
      'aria-label="Cantidad de Lechuga"',
    );
    expect(html).toContain(
      'aria-label="Lechuga: sin ingrediente"',
    );
    expect(html).toContain(
      'aria-label="Lechuga: 5 porciones"',
    );
    expect(html).toContain(
      'aria-label="Cantidad de Queso"',
    );
    expect(html).toContain(
      'aria-label="Queso: 1 porción"',
    );
    expect(html).not.toContain(
      'aria-label="Queso: sin ingrediente"',
    );
    expect(html).toContain(
      'aria-label="Cantidad de Tocino"',
    );
    expect(html).toContain(
      'aria-label="Cantidad de Pepinillos"',
    );
    expect(html).toContain(
      'aria-label="Mayonesa: Sí o No"',
    );
    expect(html).toContain(
      'aria-label="BBQ con Chipotle: Sí o No"',
    );
    expect(html).toContain(
      "Vista previa en vivo",
    );
    expect(html).toContain(
      "/burger-preview/panarriba.svg",
    );
    expect(html).toContain(
      "/burger-preview/pepinillos.svg",
    );
    expect(html).toContain(
      "/burger-preview/mayonesa.svg",
    );
    expect(html).toContain(
      "/burger-preview/chipotle.svg",
    );
    expect(html).toContain(
      "/burger-preview/bbqchipotle.svg",
    );
    expect(html).toMatch(
      /<button(?=[^>]*aria-label="Lechuga: 1 porción")(?=[^>]*disabled)[^>]*>/,
    );
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
        comboName="Hamburguesa + papas"
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
        onSetModifierQuantities={vi.fn()}
      />,
    );

    expect(html).toContain("+ Agregar combo");
    expect(html).toContain("disabled");
  });
});
