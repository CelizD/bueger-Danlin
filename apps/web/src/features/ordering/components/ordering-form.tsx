import { BurgerBuilder } from "./burger-builder";
import { CustomerFields } from "./customer-fields";
import { DrinkSelector } from "./drink-selector";
import { GroupDeliveryConsent } from "./group-delivery-consent";
import { PickupPointSelector } from "./pickup-point-selector";
import {
  formatPickup,
  money,
} from "../formatters";
import type { PublicPrivacyConfig } from "@/features/privacy/types";
import type {
  BurgerSelection,
  CatalogProduct,
  InventoryAvailability,
  ModifierOption,
  PickupEvent,
} from "../types";
import type { FormEvent } from "react";

type Props = {
  privacy: PublicPrivacyConfig;
  events: PickupEvent[];
  event: PickupEvent | null;
  combo: CatalogProduct | undefined;
  coke: CatalogProduct | undefined;
  inventory: InventoryAvailability | null;
  burgers: BurgerSelection[];
  cokes: number;
  name: string;
  phone: string;
  email: string;
  error: string;
  groupDeliveryAccepted: boolean;
  submitting: boolean;
  comboInventoryLimit: number;
  cokeInventoryLimit: number;
  maxCombosAvailable: number;
  removableOptions: ModifierOption[];
  extraOptions: ModifierOption[];
  previewTotal: number;
  onSelectPickup: (
    event: PickupEvent,
  ) => void;
  onAddBurger: () => void;
  onRemoveBurger: (
    localId: string,
  ) => void;
  onToggleRemoved: (
    burgerId: string,
    optionId: string,
  ) => void;
  onToggleExtra: (
    burgerId: string,
    optionId: string,
  ) => void;
  onCokesChange: (
    quantity: number,
  ) => void;
  onNameChange: (
    value: string,
  ) => void;
  onPhoneChange: (
    value: string,
  ) => void;
  onEmailChange: (
    value: string,
  ) => void;
  onGroupDeliveryChange: (
    checked: boolean,
  ) => void;
  onSubmit: (
    event:
      FormEvent<HTMLFormElement>,
  ) => void;
};

export function OrderingForm({
  privacy,
  events,
  event,
  combo,
  coke,
  inventory,
  burgers,
  cokes,
  name,
  phone,
  email,
  error,
  groupDeliveryAccepted,
  submitting,
  comboInventoryLimit,
  cokeInventoryLimit,
  maxCombosAvailable,
  removableOptions,
  extraOptions,
  previewTotal,
  onSelectPickup,
  onAddBurger,
  onRemoveBurger,
  onToggleRemoved,
  onToggleExtra,
  onCokesChange,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  onGroupDeliveryChange,
  onSubmit,
}: Props) {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="brand">
            BURGER DANLIN
          </p>
          <p className="topbar-copy">
            Pedidos del sábado
          </p>
        </div>

        {event && (
          <span className="availability">
            {maxCombosAvailable} de{" "}
            {event.maxCombos} disponibles
          </span>
        )}
      </header>

      <section className="hero">
        <p className="eyebrow">
          Hamburguesa + papas
        </p>
        <h1>Arma tu pedido.</h1>
        <p className="lead">
          Combo desde{" "}
          <strong>
            {money.format(
              (combo?.priceCents ??
                13000) / 100,
            )}
          </strong>
          .
          {event ? (
            <>
              {" "}
              Entrega{" "}
              {formatPickup(event)} en{" "}
              <strong>
                {event.locationLabel}
              </strong>
              .
            </>
          ) : events.length > 0 ? (
            <>
              {" "}
              Selecciona tu punto de
              entrega para continuar.
            </>
          ) : (
            <>
              {" "}
              Próxima fecha por anunciar.
            </>
          )}
        </p>
      </section>

      <PickupPointSelector
        events={events}
        selectedEventId={
          event?.id ?? null
        }
        onSelect={onSelectPickup}
      />

      {error && (
        <div
          className="alert"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <section className="sold-out">
          <p className="eyebrow">
            Pedidos cerrados
          </p>
          <h2>
            Por ahora no hay una fecha
            de entrega abierta.
          </h2>
          <p className="lead">
            Cuando abramos el siguiente
            sábado podrás hacer tu pedido
            desde aquí.
          </p>
        </section>
      ) : !event ? (
        <section className="pickup-selection-note">
          <strong>
            Selecciona un punto para
            empezar tu pedido.
          </strong>
          <span>
            La disponibilidad, horario y
            progreso de envío se calculan
            por ubicación.
          </span>
        </section>
      ) : event.status === "SOLD_OUT" ||
        comboInventoryLimit <= 0 ? (
        <section className="sold-out">
          <p className="eyebrow">
            Agotado
          </p>
          <h2>
            {event.status ===
            "SOLD_OUT"
              ? "Se agotaron los combos de este sábado."
              : "Por ahora no hay inventario suficiente para preparar más combos."}
          </h2>
        </section>
      ) : (
        <form
          onSubmit={onSubmit}
          aria-busy={submitting}
        >
          <BurgerBuilder
            burgers={burgers}
            comboPriceCents={
              combo?.priceCents ?? 0
            }
            removableOptions={
              removableOptions
            }
            extraOptions={
              extraOptions
            }
            inventory={inventory}
            maxCombosAvailable={
              maxCombosAvailable
            }
            onAddBurger={onAddBurger}
            onRemoveBurger={
              onRemoveBurger
            }
            onToggleRemoved={
              onToggleRemoved
            }
            onToggleExtra={
              onToggleExtra
            }
          />

          <DrinkSelector
            quantity={cokes}
            priceCents={
              coke?.priceCents ?? 3000
            }
            inventoryLimit={
              cokeInventoryLimit
            }
            onChange={onCokesChange}
          />

          <CustomerFields
            privacy={privacy}
            name={name}
            phone={phone}
            email={email}
            onNameChange={onNameChange}
            onPhoneChange={
              onPhoneChange
            }
            onEmailChange={
              onEmailChange
            }
          />

          <GroupDeliveryConsent
            event={event}
            checked={
              groupDeliveryAccepted
            }
            onChange={
              onGroupDeliveryChange
            }
          />

          <section className="checkout-bar">
            <div>
              <span>
                Total estimado
              </span>
              <strong>
                {money.format(
                  previewTotal / 100,
                )}
              </strong>
              <small>
                El servidor verifica el
                precio final.
              </small>
            </div>

            <button
              className="primary-button"
              type="submit"
              disabled={
                submitting ||
                burgers.length === 0 ||
                !groupDeliveryAccepted
              }
            >
              {submitting
                ? "Creando pedido…"
                : "Continuar al pago"}
            </button>
          </section>
        </form>
      )}
    </main>
  );
}
