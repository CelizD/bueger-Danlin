"use client";

import {
  CalendarDays,
  ChefHat,
  Clock3,
  Edit3,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  Truck,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
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
  status:
    | "DRAFT"
    | "OPEN"
    | "SOLD_OUT"
    | "CLOSED"
    | "COMPLETED"
    | "CANCELLED";
  paidCombos: number;
  pendingReservedCombos: number;
  reservedCombos: number;
  remainingCombos: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  locationLabel: string;
  pickupDate: string;
  pickupTime: string;
  closeDate: string;
  closeTime: string;
  maxCombos: string;
};

const TIJUANA_TIMEZONE = "America/Tijuana";

function two(value: number) {
  return String(value).padStart(2, "0");
}

function tijuanaParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIJUANA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    date: values.year + "-" + values.month + "-" + values.day,
    time: values.hour + ":" + values.minute,
  };
}

function tijuanaOffset(date: string) {
  const probe = new Date(date + "T12:00:00Z");
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIJUANA_TIMEZONE,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  })
    .formatToParts(probe)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = zoneName?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

  if (!match) {
    throw new Error("No se pudo determinar la zona horaria de Tijuana.");
  }

  const sign = match[1];
  const hours = two(Number(match[2]));
  const minutes = two(Number(match[3] ?? "0"));

  return sign + hours + ":" + minutes;
}

function tijuanaIso(date: string, time: string) {
  return new Date(
    date + "T" + time + ":00" + tijuanaOffset(date),
  ).toISOString();
}

function nextSaturdayDefaults(): FormState {
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIJUANA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    nowParts.map((part) => [part.type, part.value]),
  );

  const weekdayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const base = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      12,
    ),
  );

  const currentDay = weekdayIndex[values.weekday] ?? 0;
  const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
  base.setUTCDate(base.getUTCDate() + daysUntilSaturday);

  const close = new Date(base);
  close.setUTCDate(close.getUTCDate() - 1);

  const pickupDate =
    base.getUTCFullYear() +
    "-" +
    two(base.getUTCMonth() + 1) +
    "-" +
    two(base.getUTCDate());

  const closeDate =
    close.getUTCFullYear() +
    "-" +
    two(close.getUTCMonth() + 1) +
    "-" +
    two(close.getUTCDate());

  return {
    locationLabel: "Universidad",
    pickupDate,
    pickupTime: "09:30",
    closeDate,
    closeTime: "21:00",
    maxCombos: "50",
  };
}

function statusText(status: PickupEvent["status"]) {
  const labels: Record<PickupEvent["status"], string> = {
    DRAFT: "Borrador",
    OPEN: "Pedidos abiertos",
    SOLD_OUT: "Agotado",
    CLOSED: "Pedidos cerrados",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
  };
  return labels[status];
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TIJUANA_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function SaturdaysPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [events, setEvents] = useState<PickupEvent[]>([]);
  const [form, setForm] = useState<FormState>(() => nextSaturdayDefaults());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);

    try {
      const me = await fetch(API_URL + "/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (me.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      const meData = await me.json();

      if (!me.ok || meData.user.role !== "ADMIN") {
        window.location.replace("/admin/login");
        return;
      }

      setUser(meData.user);

      const response = await fetch(API_URL + "/admin/pickup-events", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las fechas de entrega.");
      }

      setEvents(await response.json());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las fechas de entrega.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeEvent = useMemo(
    () =>
      events.find(
        (event) => event.status === "OPEN" || event.status === "SOLD_OUT",
      ) ?? null,
    [events],
  );

  function openCreate() {
    setEditingId(null);
    setForm(nextSaturdayDefaults());
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function openEdit(event: PickupEvent) {
    const pickup = tijuanaParts(event.startsAt);
    const close = tijuanaParts(event.closesAt);

    setEditingId(event.id);
    setForm({
      locationLabel: event.locationLabel,
      pickupDate: pickup.date,
      pickupTime: pickup.time,
      closeDate: close.date,
      closeTime: close.time,
      maxCombos: String(event.maxCombos),
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(nextSaturdayDefaults());
  }

  async function save(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const startsAtIso = tijuanaIso(form.pickupDate, form.pickupTime);
      const closesAtIso = tijuanaIso(form.closeDate, form.closeTime);
      const startsAt = new Date(startsAtIso);
      const closesAt = new Date(closesAtIso);
      const maxCombos = Number(form.maxCombos);

      if (
        Number.isNaN(startsAt.getTime()) ||
        Number.isNaN(closesAt.getTime()) ||
        !Number.isInteger(maxCombos)
      ) {
        throw new Error("Revisa la fecha, hora y límite de combos.");
      }

      const response = await fetch(
        editingId
          ? API_URL + "/admin/pickup-events/" + editingId
          : API_URL + "/admin/pickup-events",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            locationLabel: form.locationLabel.trim(),
            startsAt: startsAtIso,
            closesAt: closesAtIso,
            maxCombos,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo guardar la entrega.");
      }

      setSuccess(
        editingId
          ? "La entrega se actualizó correctamente."
          : "La nueva entrega se creó como borrador.",
      );
      closeForm();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la entrega.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeOpenState(event: PickupEvent) {
    const shouldClose =
      event.status === "OPEN" || event.status === "SOLD_OUT";

    setBusyId(event.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        API_URL +
          "/admin/pickup-events/" +
          event.id +
          (shouldClose ? "/close" : "/open"),
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(
          message ||
            (shouldClose
              ? "No se pudieron cerrar los pedidos."
              : "No se pudieron abrir los pedidos."),
        );
      }

      setSuccess(
        shouldClose
          ? "Pedidos cerrados para esa fecha."
          : "Pedidos abiertos. Esa es ahora la fecha activa para clientes.",
      );
      await load();
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "No se pudo cambiar el estado.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch(API_URL + "/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.replace("/admin/login");
  }

  if (loading) {
    return <main className="admin-loading">Cargando sábados…</main>;
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">BD</div>
            <div>
              <strong>Burger Danlin</strong>
              <span>Operaciones</span>
            </div>
          </div>

          <nav className="admin-nav">
            <a href="/admin/pedidos">
              <ShoppingBag size={18} strokeWidth={1.8} />
              Pedidos
            </a>
            <a href="/admin/cocina">
              <ChefHat size={18} strokeWidth={1.8} />
              Cocina
            </a>
            <a href="/admin/entrega">
              <Truck size={18} strokeWidth={1.8} />
              Entrega
            </a>
            <a className="active" href="/admin/sabados">
              <CalendarDays size={18} strokeWidth={1.8} />
              Sábados
            </a>
          </nav>
        </div>

        <div className="admin-sidebar-user">
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <button type="button" onClick={logout} aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <section className="admin-content saturday-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">Calendario de ventas</p>
            <h1>Sábados</h1>
            <p>
              Crea la siguiente entrega, define el cupo y controla cuándo
              pueden ordenar los clientes.
            </p>
          </div>

          <div className="saturday-header-actions">
            <button
              className="admin-refresh"
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "admin-spin" : undefined}
              />
              Actualizar
            </button>
            <button
              className="saturday-create-button"
              type="button"
              onClick={openCreate}
            >
              <Plus size={17} />
              Nueva fecha
            </button>
          </div>
        </header>

        {error && <div className="admin-error-banner">{error}</div>}
        {success && <div className="saturday-success">{success}</div>}

        <section className="saturday-overview">
          <article>
            <CalendarDays size={19} />
            <span>Fecha activa</span>
            <strong>{activeEvent ? activeEvent.name : "Sin fecha abierta"}</strong>
          </article>
          <article>
            <Package size={19} />
            <span>Disponibles</span>
            <strong>
              {activeEvent
                ? activeEvent.remainingCombos + " / " + activeEvent.maxCombos
                : "—"}
            </strong>
          </article>
          <article>
            <Clock3 size={19} />
            <span>Cierre actual</span>
            <strong>
              {activeEvent
                ? new Intl.DateTimeFormat("es-MX", {
                    timeZone: TIJUANA_TIMEZONE,
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(activeEvent.closesAt))
                : "—"}
            </strong>
          </article>
        </section>

        {formOpen && (
          <section className="saturday-form-card">
            <div className="saturday-form-head">
              <div>
                <p className="admin-kicker">
                  {editingId ? "Editar configuración" : "Nueva entrega"}
                </p>
                <h2>
                  {editingId ? "Modificar sábado" : "Programar sábado"}
                </h2>
              </div>
              <button type="button" onClick={closeForm} aria-label="Cerrar formulario">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={save} className="saturday-form">
              <label className="saturday-full-field">
                <span>Lugar de entrega</span>
                <div className="saturday-input-icon">
                  <MapPin size={17} />
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.locationLabel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        locationLabel: event.target.value,
                      }))
                    }
                    placeholder="Universidad"
                  />
                </div>
              </label>

              <label>
                <span>Fecha de entrega</span>
                <input
                  required
                  type="date"
                  value={form.pickupDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pickupDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Hora de entrega</span>
                <input
                  required
                  type="time"
                  value={form.pickupTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pickupTime: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Fecha límite para ordenar</span>
                <input
                  required
                  type="date"
                  value={form.closeDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      closeDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Hora límite</span>
                <input
                  required
                  type="time"
                  value={form.closeTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      closeTime: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Límite de combos</span>
                <input
                  required
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={form.maxCombos}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maxCombos: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="saturday-form-note">
                Los horarios se interpretan directamente en la zona{" "}
                <strong>America/Tijuana</strong>, aunque abras el panel desde
                otro dispositivo.
              </div>

              <div className="saturday-form-actions">
                <button
                  className="saturday-cancel"
                  type="button"
                  onClick={closeForm}
                >
                  Cancelar
                </button>
                <button
                  className="saturday-save"
                  type="submit"
                  disabled={saving}
                >
                  <Save size={17} />
                  {saving
                    ? "Guardando…"
                    : editingId
                      ? "Guardar cambios"
                      : "Crear borrador"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="saturday-list">
          {events.length === 0 ? (
            <div className="admin-empty">
              Todavía no hay fechas de entrega. Crea el primer sábado.
            </div>
          ) : (
            events.map((event) => {
              const capacityPercent =
                event.maxCombos > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (event.reservedCombos / event.maxCombos) * 100,
                      ),
                    )
                  : 0;

              const canToggle =
                event.status !== "COMPLETED" &&
                event.status !== "CANCELLED";

              const isOpen =
                event.status === "OPEN" || event.status === "SOLD_OUT";

              return (
                <article
                  className={
                    "saturday-card " + (isOpen ? "active-event" : "")
                  }
                  key={event.id}
                >
                  <div className="saturday-card-main">
                    <div className="saturday-card-date">
                      <span>
                        {new Intl.DateTimeFormat("es-MX", {
                          timeZone: TIJUANA_TIMEZONE,
                          month: "short",
                        })
                          .format(new Date(event.startsAt))
                          .replace(".", "")
                          .toUpperCase()}
                      </span>
                      <strong>
                        {new Intl.DateTimeFormat("es-MX", {
                          timeZone: TIJUANA_TIMEZONE,
                          day: "2-digit",
                        }).format(new Date(event.startsAt))}
                      </strong>
                    </div>

                    <div className="saturday-card-info">
                      <div className="saturday-card-title">
                        <div>
                          <strong>{event.name}</strong>
                          <span>{event.code}</span>
                        </div>
                        <span
                          className={
                            "saturday-status status-" +
                            event.status.toLowerCase()
                          }
                        >
                          {statusText(event.status)}
                        </span>
                      </div>

                      <div className="saturday-details">
                        <span>
                          <MapPin size={14} />
                          {event.locationLabel}
                        </span>
                        <span>
                          <Clock3 size={14} />
                          {formatDate(event.startsAt)}
                        </span>
                      </div>

                      <div className="saturday-capacity">
                        <div className="saturday-capacity-head">
                          <span>
                            {event.reservedCombos} de {event.maxCombos} combos
                            ocupados
                          </span>
                          <strong>{event.remainingCombos} disponibles</strong>
                        </div>
                        <div className="saturday-progress">
                          <span style={{ width: capacityPercent + "%" }} />
                        </div>
                      </div>

                      <div className="saturday-breakdown">
                        <span>
                          <b>{event.paidCombos}</b> pagados
                        </span>
                        <span>
                          <b>{event.pendingReservedCombos}</b> reservados
                          temporalmente
                        </span>
                        <span>
                          Cierre:{" "}
                          <b>
                            {new Intl.DateTimeFormat("es-MX", {
                              timeZone: TIJUANA_TIMEZONE,
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(event.closesAt))}
                          </b>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="saturday-card-actions">
                    <button
                      type="button"
                      className="saturday-edit"
                      onClick={() => openEdit(event)}
                      disabled={
                        event.status === "COMPLETED" ||
                        event.status === "CANCELLED"
                      }
                    >
                      <Edit3 size={16} />
                      Editar
                    </button>

                    {canToggle && (
                      <button
                        type="button"
                        className={
                          isOpen
                            ? "saturday-toggle close"
                            : "saturday-toggle open"
                        }
                        onClick={() => void changeOpenState(event)}
                        disabled={busyId === event.id}
                      >
                        {isOpen ? (
                          <ToggleLeft size={18} />
                        ) : (
                          <ToggleRight size={18} />
                        )}
                        {busyId === event.id
                          ? "Actualizando…"
                          : isOpen
                            ? "Cerrar pedidos"
                            : "Abrir pedidos"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </section>
    </main>
  );
}
