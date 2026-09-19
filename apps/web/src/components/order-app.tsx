"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type ModifierOption = {
  id: string;
  name: string;
  kind: "REMOVABLE" | "EXTRA" | "ADD_ON";
  priceDeltaCents: number;
  defaultSelected: boolean;
};

type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: "COMBO" | "BEVERAGE" | "ADD_ON";
  priceCents: number;
  modifierGroups: Array<{
    modifierGroup: {
      id: string;
      name: string;
      active: boolean;
      options: ModifierOption[];
    };
  }>;
};

type PickupEvent = {
  id: string;
  code: string;
  name: string;
  locationLabel: string;
  timezone: string;
  startsAt: string;
  closesAt: string;
  maxCombos: number;
  reservedCombos: number;
  remainingCombos: number;
  status: "OPEN" | "SOLD_OUT";
};

type BurgerSelection = {
  localId: string;
  removedIds: string[];
  extraIds: string[];
};

type CreatedOrder = {
  orderCode: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalCents: number;
  comboQuantity: number;
  reservationExpiresAt: string;
  verificationToken: string;
  pickup: {
    locationLabel: string;
    startsAt: string;
    closesAt: string;
    timezone: string;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function formatPickup(event: PickupEvent) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: event.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
}

function pickupQrPayload(order: CreatedOrder) {
  return `BD1:${order.orderCode}:${order.verificationToken}`;
}

function newBurger(): BurgerSelection {
  return {
    localId: crypto.randomUUID(),
    removedIds: [],
    extraIds: [],
  };
}

export function OrderApp() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [event, setEvent] = useState<PickupEvent | null>(null);
  const [burgers, setBurgers] = useState<BurgerSelection[]>([]);
  const [cokes, setCokes] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
        const [catalogResponse, eventResponse] = await Promise.all([
          fetch(`${API_URL}/catalog`, { cache: "no-store" }),
          fetch(`${API_URL}/pickup-events/current`, { cache: "no-store" }),
        ]);

        if (!catalogResponse.ok) {
          throw new Error("No se pudo cargar el menú.");
        }

        if (!eventResponse.ok && eventResponse.status !== 404) {
          throw new Error("No se pudo consultar la fecha de entrega.");
        }

        const catalogData =
          (await catalogResponse.json()) as CatalogProduct[];
        const eventData =
          eventResponse.status === 404
            ? null
            : ((await eventResponse.json()) as PickupEvent);

        if (!cancelled) {
          setCatalog(catalogData);
          setEvent(eventData);
          setBurgers(
            eventData && eventData.remainingCombos > 0 ? [newBurger()] : [],
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

  const removableOptions = useMemo(
    () =>
      combo?.modifierGroups
        .flatMap((group) => group.modifierGroup.options)
        .filter((option) => option.kind === "REMOVABLE") ?? [],
    [combo],
  );

  const extraOptions = useMemo(
    () =>
      combo?.modifierGroups
        .flatMap((group) => group.modifierGroup.options)
        .filter((option) => option.kind === "EXTRA") ?? [],
    [combo],
  );

  const previewTotal = useMemo(() => {
    if (!combo) return 0;

    const burgersTotal = burgers.reduce((sum, burger) => {
      const extras = extraOptions
        .filter((option) => burger.extraIds.includes(option.id))
        .reduce((extraSum, option) => extraSum + option.priceDeltaCents, 0);

      return sum + combo.priceCents + extras;
    }, 0);

    return burgersTotal + (coke?.priceCents ?? 0) * cokes;
  }, [burgers, combo, coke, cokes, extraOptions]);

  function toggleRemoved(burgerId: string, optionId: string) {
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
    if (!event || burgers.length >= event.remainingCombos) return;
    setBurgers((current) => [...current, newBurger()]);
  }

  function removeBurger(localId: string) {
    setBurgers((current) => current.filter((burger) => burger.localId !== localId));
  }

  async function submitOrder(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();

    if (!event || !combo || burgers.length === 0) return;

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

      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          pickupEventId: event.id,
          customer: {
            name: name.trim(),
            phone: `+52${cleanPhone}`,
            email: email.trim() || undefined,
          },
          items,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo crear el pedido.");
      }

      const orderData = data as CreatedOrder;
      setCreatedOrder(orderData);
      window.localStorage.setItem(
        `burger-danlin:order-token:${orderData.orderCode}`,
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
      const response = await fetch(
        `${API_URL}/orders/${encodeURIComponent(createdOrder.orderCode)}/cancel`,
        {
          method: "POST",
          headers: {
            "x-order-token": createdOrder.verificationToken,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo cancelar el pedido.");
      }

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
      const response = await fetch(
        `${API_URL}/payments/mock/${createdOrder.orderCode}/confirm`,
        {
          method: "POST",
          headers: {
            "x-order-token": createdOrder.verificationToken,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo confirmar el pago local.");
      }

      setCreatedOrder((current) =>
        current
          ? {
              ...current,
              status: data.status,
              paymentStatus: data.paymentStatus,
            }
          : current,
      );
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
        <p className="status-text">Cargando menú local…</p>
      </main>
    );
  }

  if (createdOrder) {
    const isPaid = createdOrder.paymentStatus === "PAID";
    const isCancelled =
      createdOrder.status === "CANCELLED" || createdOrder.status === "REFUNDED";
    const cancellationOpen =
      !isCancelled && new Date() < new Date(createdOrder.pickup.closesAt);

    return (
      <main className="shell">
        <section className="confirmation">
          <p className="eyebrow">
            {isCancelled
              ? createdOrder.status === "REFUNDED"
                ? "Pedido reembolsado"
                : "Pedido cancelado"
              : isPaid
                ? "Pago confirmado"
                : "Pedido reservado"}
          </p>
          <h1>{createdOrder.orderCode}</h1>
          <p className="lead">
            {isCancelled
              ? createdOrder.status === "REFUNDED"
                ? "Tu pedido fue cancelado y el reembolso local quedó completado."
                : "Tu pedido fue cancelado y el cupo quedó liberado."
              : isPaid
                ? "Tu pedido local quedó pagado y confirmado para continuar con cocina y entrega."
                : `Reservamos ${createdOrder.comboQuantity} combo(s) durante 15 minutos mientras completas el pago.`}
          </p>

          {error && <div className="alert">{error}</div>}
          {cancelMessage && (
            <div className="customer-cancel-success">{cancelMessage}</div>
          )}

          <div className="confirmation-grid">
            <div>
              <span>Total</span>
              <strong>{money.format(createdOrder.totalCents / 100)}</strong>
            </div>
            <div>
              <span>Entrega</span>
              <strong>{createdOrder.pickup.locationLabel}</strong>
              <small>
                {new Intl.DateTimeFormat("es-MX", {
                  timeZone: createdOrder.pickup.timezone,
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(createdOrder.pickup.startsAt))}
              </small>
            </div>
          </div>

          {!isPaid && !isCancelled && (
            <button
              className="primary-button payment-button"
              type="button"
              onClick={confirmMockPayment}
              disabled={paying}
            >
              {paying ? "Confirmando pago…" : "Simular pago local"}
            </button>
          )}

          {isPaid && !isCancelled && (
            <>
              <div className="paid-badge">
                Pago local aprobado
              </div>

              <div className="customer-qr-card">
                <div className="customer-qr-copy">
                  <p className="eyebrow">Código de entrega</p>
                  <h2>Presenta este QR</h2>
                  <p>
                    Muéstralo al momento de recoger tu pedido. El personal lo
                    escaneará para confirmar la entrega.
                  </p>
                </div>

                <div className="customer-qr-frame" aria-label="QR de entrega">
                  <QRCodeSVG
                    value={pickupQrPayload(createdOrder)}
                    size={220}
                    level="H"
                    marginSize={2}
                    title={`Pedido ${createdOrder.orderCode}`}
                  />
                </div>

                <div className="customer-qr-code">
                  <span>Pedido</span>
                  <strong>{createdOrder.orderCode}</strong>
                </div>

                <p className="customer-qr-warning">
                  No compartas este QR públicamente. Funciona como comprobante
                  para retirar tu pedido.
                </p>
              </div>
            </>
          )}

          <div className="customer-order-actions">
            {!isCancelled && cancellationOpen && (
              <button
                className="customer-cancel-button"
                type="button"
                onClick={cancelCreatedOrder}
                disabled={canceling}
              >
                {canceling
                  ? "Cancelando…"
                  : isPaid
                    ? "Cancelar e iniciar reembolso"
                    : "Cancelar pedido"}
              </button>
            )}

            <a
              className="customer-manage-link"
              href={`/pedido/${encodeURIComponent(createdOrder.orderCode)}#token=${encodeURIComponent(createdOrder.verificationToken)}`}
            >
              Administrar mi pedido
            </a>
          </div>

          <p className="technical-note">
            Estado: {createdOrder.status} · Pago: {createdOrder.paymentStatus}
            {!isCancelled && (
              <>
                {" "}· Cancelaciones hasta{" "}
                {new Intl.DateTimeFormat("es-MX", {
                  timeZone: createdOrder.pickup.timezone,
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(createdOrder.pickup.closesAt))}
              </>
            )}
          </p>
        </section>
      </main>
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
            {event.remainingCombos} de {event.maxCombos} disponibles
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
          ) : (
            <> Próxima fecha por anunciar.</>
          )}
        </p>
      </section>

      {error && <div className="alert">{error}</div>}

      {!event ? (
        <section className="sold-out">
          <p className="eyebrow">Pedidos cerrados</p>
          <h2>Por ahora no hay una fecha de entrega abierta.</h2>
          <p className="lead">
            Cuando abramos el siguiente sábado podrás hacer tu pedido desde aquí.
          </p>
        </section>
      ) : event.status === "SOLD_OUT" ? (
        <section className="sold-out">
          <p className="eyebrow">Agotado</p>
          <h2>Se agotaron los combos de este sábado.</h2>
        </section>
      ) : (
        <form onSubmit={submitOrder}>
          <section className="section">
            <div className="section-heading">
              <div>
                <p className="step">01</p>
                <h2>Tus hamburguesas</h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={addBurger}
                disabled={burgers.length >= event.remainingCombos}
              >
                + Agregar combo
              </button>
            </div>

            <div className="burger-list">
              {burgers.map((burger, burgerIndex) => (
                <article className="burger-card" key={burger.localId}>
                  <div className="burger-card-title">
                    <div>
                      <span>Combo {burgerIndex + 1}</span>
                      <strong>{money.format((combo?.priceCents ?? 0) / 100)}</strong>
                    </div>
                    {burgers.length > 1 && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => removeBurger(burger.localId)}
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <div className="option-block">
                    <p className="option-title">Ingredientes incluidos</p>
                    <p className="option-help">Desmarca lo que no quieras.</p>
                    <div className="option-grid">
                      {removableOptions.map((option) => {
                        const included = !burger.removedIds.includes(option.id);
                        return (
                          <label className="check-row" key={option.id}>
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={() => toggleRemoved(burger.localId, option.id)}
                            />
                            <span>{option.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="option-block">
                    <p className="option-title">Extras</p>
                    <div className="option-grid">
                      {extraOptions.map((option) => (
                        <label className="check-row extra-row" key={option.id}>
                          <input
                            type="checkbox"
                            checked={burger.extraIds.includes(option.id)}
                            onChange={() => toggleExtra(burger.localId, option.id)}
                          />
                          <span>{option.name}</span>
                          <strong>
                            +{money.format(option.priceDeltaCents / 100)}
                          </strong>
                        </label>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <p className="step">02</p>
                <h2>Bebida</h2>
              </div>
            </div>

            <div className="drink-row">
              <div>
                <strong>Coca-Cola lata</strong>
                <span>{money.format((coke?.priceCents ?? 3000) / 100)} c/u</span>
              </div>
              <div className="quantity">
                <button
                  type="button"
                  onClick={() => setCokes((value) => Math.max(0, value - 1))}
                  aria-label="Quitar Coca-Cola"
                >
                  −
                </button>
                <span>{cokes}</span>
                <button
                  type="button"
                  onClick={() => setCokes((value) => Math.min(20, value + 1))}
                  aria-label="Agregar Coca-Cola"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <p className="step">03</p>
                <h2>Tus datos</h2>
              </div>
            </div>

            <div className="form-grid">
              <label>
                <span>Nombre *</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(input) => setName(input.target.value)}
                  placeholder="Tu nombre"
                />
              </label>

              <label>
                <span>Teléfono *</span>
                <div className="phone-input">
                  <b>+52</b>
                  <input
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(input) => setPhone(input.target.value.replace(/\D/g, ""))}
                    placeholder="6641234567"
                  />
                </div>
              </label>

              <label className="full-field">
                <span>Correo (opcional)</span>
                <input
                  type="email"
                  maxLength={160}
                  value={email}
                  onChange={(input) => setEmail(input.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </label>
            </div>
          </section>

          <section className="checkout-bar">
            <div>
              <span>Total estimado</span>
              <strong>{money.format(previewTotal / 100)}</strong>
              <small>El servidor verifica el precio final.</small>
            </div>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting || burgers.length === 0}
            >
              {submitting ? "Creando pedido…" : "Continuar al pago"}
            </button>
          </section>
        </form>
      )}
    </main>
  );
}
