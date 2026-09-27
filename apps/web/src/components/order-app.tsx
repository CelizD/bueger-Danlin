"use client";

import {
  cancelOrder,
  confirmMockOrderPayment,
  createOrder,
  loadCustomerOrder,
  loadOrderingData,
} from "@/features/ordering/api";
import { BurgerBuilder } from "@/features/ordering/components/burger-builder";
import { CustomerFields } from "@/features/ordering/components/customer-fields";
import { DrinkSelector } from "@/features/ordering/components/drink-selector";
import { GroupDeliveryConsent } from "@/features/ordering/components/group-delivery-consent";
import { PickupPointSelector } from "@/features/ordering/components/pickup-point-selector";
import {
  formatPickup,
  money,
  newBurger,
  orderTokenStorageKey,
} from "@/features/ordering/formatters";
import {
  availableComboLimit,
  calculatePreviewTotal,
  modifierOptions,
  productInventoryLimit,
  unavailableIncludedModifierIds,
} from "@/features/ordering/selectors";
import type {
  BurgerSelection,
  CatalogProduct,
  CreatedOrder,
  InventoryAvailability,
  PickupEvent,
} from "@/features/ordering/types";
import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";

const OrderConfirmation = dynamic(
  () =>
    import(
      "@/features/ordering/components/order-confirmation"
    ).then((module) => module.OrderConfirmation),
  {
    loading: () => (
      <main className="shell">
        <p className="status-text" role="status" aria-live="polite">
          Preparando confirmación…
        </p>
      </main>
    ),
  },
);

export function OrderApp() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [events, setEvents] = useState<PickupEvent[]>([]);
  const [event, setEvent] = useState<PickupEvent | null>(null);
  const [inventory, setInventory] = useState<InventoryAvailability | null>(null);
  const [burgers, setBurgers] = useState<BurgerSelection[]>([]);
  const [cokes, setCokes] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [groupDeliveryAccepted, setGroupDeliveryAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const [cancelMessage, setCancelMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          catalog: catalogData,
          events: eventData,
          inventory: inventoryData,
        } = await loadOrderingData();

        const comboData = catalogData.find(
          (product) => product.type === "COMBO",
        );
        const unavailableIncludedIds =
          unavailableIncludedModifierIds(
            comboData,
            inventoryData,
          );
        const comboInventoryLimit = productInventoryLimit(
          comboData,
          inventoryData,
        );

        if (!cancelled) {
          const pickupCode =
            new URLSearchParams(window.location.search)
              .get("pickup")
              ?.trim()
              .toUpperCase() ?? "";

          const preselected =
            eventData.find(
              (item) =>
                item.status === "OPEN" &&
                (item.pickupPoint.code.toUpperCase() === pickupCode ||
                  item.code.toUpperCase() === pickupCode),
            ) ??
            (eventData.length === 1 && eventData[0]?.status === "OPEN"
              ? eventData[0]
              : null);

          setCatalog(catalogData);
          setInventory(inventoryData);
          setEvents(eventData);
          setEvent(preselected);
          setBurgers(
            preselected &&
              preselected.remainingCombos > 0 &&
              comboInventoryLimit > 0
              ? [newBurger(unavailableIncludedIds)]
              : [],
          );
        }
      } catch {
        if (!cancelled) {
          setError(
            "No pudimos conectar con el servidor local. Revisa que el API y PostgreSQL estén encendidos.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const combo = catalog.find((product) => product.type === "COMBO");
  const coke = catalog.find((product) => product.slug === "coca-cola-lata");

  const comboInventoryLimit = productInventoryLimit(
    combo,
    inventory,
  );
  const cokeInventoryLimit = productInventoryLimit(
    coke,
    inventory,
  );
  const maxCombosAvailable = availableComboLimit(
    event,
    comboInventoryLimit,
  );

  const removableOptions = useMemo(
    () => modifierOptions(combo, "REMOVABLE"),
    [combo],
  );

  const extraOptions = useMemo(
    () => modifierOptions(combo, "EXTRA"),
    [combo],
  );

  const previewTotal = useMemo(
    () =>
      calculatePreviewTotal(
        burgers,
        combo,
        coke,
        cokes,
        extraOptions,
      ),
    [burgers, combo, coke, cokes, extraOptions],
  );

  function selectPickupEvent(nextEvent: PickupEvent) {
    if (nextEvent.status !== "OPEN") return;

    const nextLimit = availableComboLimit(
      nextEvent,
      comboInventoryLimit,
    );

    setEvent(nextEvent);
    setGroupDeliveryAccepted(false);
    setError("");
    setBurgers((current) => {
      if (nextLimit <= 0) return [];

      if (current.length === 0) {
        return [
          newBurger(
            unavailableIncludedModifierIds(
              combo,
              inventory ?? {
                items: [],
                productLimits: {},
                modifierLimits: {},
              },
            ),
          ),
        ];
      }

      return current.slice(0, nextLimit);
    });

    const url = new URL(window.location.href);
    url.searchParams.set("pickup", nextEvent.pickupPoint.code);
    window.history.replaceState(null, "", url);
  }

  function toggleRemoved(burgerId: string, optionId: string) {
    const limit = inventory?.modifierLimits[optionId];
    const burger = burgers.find((item) => item.localId === burgerId);
    const tryingToInclude = burger?.removedIds.includes(optionId) ?? false;

    if (tryingToInclude && limit !== undefined) {
      const includedElsewhere = burgers.filter(
        (item) =>
          item.localId !== burgerId &&
          !item.removedIds.includes(optionId),
      ).length;

      if (includedElsewhere >= limit) {
        setError("Ese ingrediente ya no tiene inventario disponible.");
        return;
      }
    }

    setBurgers((current) =>
      current.map((burger) =>
        burger.localId === burgerId
          ? {
              ...burger,
              removedIds: burger.removedIds.includes(optionId)
                ? burger.removedIds.filter((id) => id !== optionId)
                : [...burger.removedIds, optionId],
            }
          : burger,
      ),
    );
  }

  function toggleExtra(burgerId: string, optionId: string) {
    const limit = inventory?.modifierLimits[optionId];
    const selectedCount = burgers.filter((burger) =>
      burger.extraIds.includes(optionId),
    ).length;
    const burger = burgers.find((item) => item.localId === burgerId);
    const alreadySelected = burger?.extraIds.includes(optionId) ?? false;

    if (!alreadySelected && limit !== undefined && selectedCount >= limit) {
      setError("Ese extra ya no tiene inventario disponible.");
      return;
    }

    setBurgers((current) =>
      current.map((burger) =>
        burger.localId === burgerId
          ? {
              ...burger,
              extraIds: burger.extraIds.includes(optionId)
                ? burger.extraIds.filter((id) => id !== optionId)
                : [...burger.extraIds, optionId],
            }
          : burger,
      ),
    );
  }

  function addBurger() {
    if (!event || burgers.length >= maxCombosAvailable) return;

    const removedForNewBurger = removableOptions
      .filter((option) => {
        const limit = inventory?.modifierLimits[option.id];

        if (limit === undefined) return false;

        const currentlyIncluded = burgers.filter(
          (burger) => !burger.removedIds.includes(option.id),
        ).length;

        return currentlyIncluded >= limit;
      })
      .map((option) => option.id);

    setBurgers((current) => [
      ...current,
      newBurger(removedForNewBurger),
    ]);
  }

  function removeBurger(localId: string) {
    setBurgers((current) => current.filter((burger) => burger.localId !== localId));
  }

  async function submitOrder(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();

    if (!event || !combo || burgers.length === 0) return;

    if (!groupDeliveryAccepted) {
      setError(
        "Debes aceptar las condiciones de entrega grupal antes de continuar.",
      );
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length !== 10) {
      setError("El teléfono debe tener 10 dígitos.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const items = burgers.map((burger) => ({
        productId: combo.id,
        quantity: 1,
        removedModifierOptionIds: burger.removedIds,
        extraModifierOptionIds: burger.extraIds,
      }));

      if (cokes > 0 && coke) {
        items.push({
          productId: coke.id,
          quantity: cokes,
          removedModifierOptionIds: [],
          extraModifierOptionIds: [],
        });
      }

      const orderData = await createOrder({
        pickupEventId: event.id,
        groupDeliveryTermsAccepted: groupDeliveryAccepted,
        customer: {
          name: name.trim(),
          phone: `+52${cleanPhone}`,
          email: email.trim() || undefined,
        },
        items,
      });

      setCreatedOrder(orderData);
      window.sessionStorage.setItem(
        orderTokenStorageKey(orderData.orderCode),
        orderData.verificationToken,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el pedido.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelCreatedOrder() {
    if (!createdOrder) return;

    const confirmed = window.confirm(
      createdOrder.paymentStatus === "PAID"
        ? "¿Cancelar este pedido? También se iniciará el reembolso."
        : "¿Cancelar este pedido? Se liberará el cupo reservado.",
    );

    if (!confirmed) return;

    setCanceling(true);
    setError("");
    setCancelMessage("");

    try {
      const data = await cancelOrder(
        createdOrder.orderCode,
        createdOrder.verificationToken,
      );

      setCreatedOrder((current) =>
        current
          ? {
              ...current,
              status: data.status,
              paymentStatus: data.paymentStatus,
            }
          : current,
      );

      setCancelMessage(
        data.refundStatus === "REFUNDED"
          ? "Pedido cancelado y reembolso local completado."
          : data.refundStatus === "PENDING"
            ? "Pedido cancelado. El reembolso está en proceso."
            : "Pedido cancelado y cupo liberado.",
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "No se pudo cancelar el pedido.",
      );
    } finally {
      setCanceling(false);
    }
  }

  async function confirmMockPayment() {
    if (!createdOrder || createdOrder.paymentStatus === "PAID") return;

    setPaying(true);
    setError("");

    try {
      const data = await confirmMockOrderPayment(
        createdOrder.orderCode,
        createdOrder.verificationToken,
      );

      setCreatedOrder((current) =>
        current
          ? {
              ...current,
              status: data.status,
              paymentStatus: data.paymentStatus,
            }
          : current,
      );

      try {
        const refreshed = await loadCustomerOrder(
          createdOrder.orderCode,
          createdOrder.verificationToken,
        );

        setCreatedOrder((current) =>
          current
            ? {
                ...current,
                status: refreshed.status,
                paymentStatus: refreshed.paymentStatus,
                groupDelivery: refreshed.groupDelivery,
              }
            : current,
        );
      } catch {
        // El pago ya quedó confirmado. Si la actualización del progreso
        // falla, "Administrar mi pedido" lo recalculará al abrirse.
      }
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No se pudo confirmar el pago local.",
      );
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="status-text" role="status" aria-live="polite">Cargando menú local…</p>
      </main>
    );
  }

  if (createdOrder) {
    return (
      <OrderConfirmation
        order={createdOrder}
        error={error}
        cancelMessage={cancelMessage}
        paying={paying}
        canceling={canceling}
        onConfirmPayment={() => void confirmMockPayment()}
        onCancel={() => void cancelCreatedOrder()}
      />
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="brand">BURGER DANLIN</p>
          <p className="topbar-copy">Pedidos del sábado</p>
        </div>
        {event && (
          <span className="availability">
            {maxCombosAvailable} de {event.maxCombos} disponibles
          </span>
        )}
      </header>

      <section className="hero">
        <p className="eyebrow">Hamburguesa + papas</p>
        <h1>Arma tu pedido.</h1>
        <p className="lead">
          Combo desde{" "}
          <strong>{money.format((combo?.priceCents ?? 13000) / 100)}</strong>.
          {event ? (
            <>
              {" "}Entrega {formatPickup(event)} en{" "}
              <strong>{event.locationLabel}</strong>.
            </>
          ) : events.length > 0 ? (
            <> Selecciona tu punto de entrega para continuar.</>
          ) : (
            <> Próxima fecha por anunciar.</>
          )}
        </p>
      </section>

      <PickupPointSelector
        events={events}
        selectedEventId={event?.id ?? null}
        onSelect={selectPickupEvent}
      />

      {error && (
            <div className="alert" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

      {events.length === 0 ? (
        <section className="sold-out">
          <p className="eyebrow">Pedidos cerrados</p>
          <h2>Por ahora no hay una fecha de entrega abierta.</h2>
          <p className="lead">
            Cuando abramos el siguiente sábado podrás hacer tu pedido desde aquí.
          </p>
        </section>
      ) : !event ? (
        <section className="pickup-selection-note">
          <strong>Selecciona un punto para empezar tu pedido.</strong>
          <span>La disponibilidad, horario y progreso de envío se calculan por ubicación.</span>
        </section>
      ) : event.status === "SOLD_OUT" || comboInventoryLimit <= 0 ? (
        <section className="sold-out">
          <p className="eyebrow">Agotado</p>
          <h2>
            {event.status === "SOLD_OUT"
              ? "Se agotaron los combos de este sábado."
              : "Por ahora no hay inventario suficiente para preparar más combos."}
          </h2>
        </section>
      ) : (
        <form onSubmit={submitOrder} aria-busy={submitting}>
          <BurgerBuilder
            burgers={burgers}
            comboPriceCents={combo?.priceCents ?? 0}
            removableOptions={removableOptions}
            extraOptions={extraOptions}
            inventory={inventory}
            maxCombosAvailable={maxCombosAvailable}
            onAddBurger={addBurger}
            onRemoveBurger={removeBurger}
            onToggleRemoved={toggleRemoved}
            onToggleExtra={toggleExtra}
          />

          <DrinkSelector
            quantity={cokes}
            priceCents={coke?.priceCents ?? 3000}
            inventoryLimit={cokeInventoryLimit}
            onChange={setCokes}
          />

          <CustomerFields
            name={name}
            phone={phone}
            email={email}
            onNameChange={setName}
            onPhoneChange={setPhone}
            onEmailChange={setEmail}
          />

          <GroupDeliveryConsent
            event={event}
            checked={groupDeliveryAccepted}
            onChange={setGroupDeliveryAccepted}
          />

          <section className="checkout-bar">
            <div>
              <span>Total estimado</span>
              <strong>{money.format(previewTotal / 100)}</strong>
              <small>El servidor verifica el precio final.</small>
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
              {submitting ? "Creando pedido…" : "Continuar al pago"}
            </button>
          </section>
        </form>
      )}
    </main>
  );
}
