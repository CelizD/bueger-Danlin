"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { API_URL, apiFetch } from "@/lib/api/browser";
import {
  Boxes,
  BarChart3,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  CupSoda,
  LogOut,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Ticket,
  Truck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

type DashboardEvent = {
  id: string;
  code: string;
  name: string;
  locationLabel: string;
  startsAt: string;
  closesAt: string;
  status: string;
};

type DashboardData = {
  filter: {
    pickupEventId: string | null;
    selectedEvent: DashboardEvent | null;
    events: DashboardEvent[];
  };
  metrics: {
    revenueCents: number;
    combosSold: number;
    cokesSold: number;
    averageTicketCents: number;
    effectiveOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    noShowOrders: number;
  };
  topExtras: Array<{
    name: string;
    quantity: number;
    revenueCents: number;
  }>;
  salesByEvent: Array<{
    id: string;
    code: string;
    name: string;
    startsAt: string;
    revenueCents: number;
    combosSold: number;
    paidOrders: number;
  }>;
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function eventDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Tijuana",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function DashboardPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(
    pickupEventId = selectedEventId,
    showRefresh = false,
  ) {
    if (showRefresh) setRefreshing(true);

    try {
      const me = await apiFetch(`${API_URL}/auth/me`, {
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

      const query =
        pickupEventId === "ALL"
          ? ""
          : `?pickupEventId=${encodeURIComponent(pickupEventId)}`;

      const response = await apiFetch(`${API_URL}/admin/dashboard${query}`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar las métricas de ventas.");
      }

      setData(await response.json());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load("ALL");
  }, []);

  const maxExtraQuantity = useMemo(
    () => Math.max(1, ...(data?.topExtras.map((extra) => extra.quantity) ?? [1])),
    [data],
  );

  const maxEventRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.salesByEvent.map((event) => event.revenueCents) ?? [1]),
      ),
    [data],
  );

  async function changeEvent(value: string) {
    setSelectedEventId(value);
    setLoading(true);
    await load(value);
  }

  async function logout() {
    await apiFetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.replace("/admin/login");
  }

  if (loading && !data) {
    return <main className="admin-loading">Cargando dashboard…</main>;
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="dashboard"
        subtitle="Operaciones"
      />

      <section className="admin-content dashboard-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">Rendimiento del negocio</p>
            <h1>Dashboard</h1>
            <p>
              Ventas, productos y resultados de la operación en un solo lugar.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <select
              value={selectedEventId}
              onChange={(event) => void changeEvent(event.target.value)}
              aria-label="Filtrar dashboard por sábado"
            >
              <option value="ALL">Todos los sábados</option>
              {data?.filter.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {eventDate(event.startsAt)} · {event.locationLabel}
                </option>
              ))}
            </select>

            <button
              className="admin-refresh"
              type="button"
              onClick={() => void load(selectedEventId, true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "admin-spin" : undefined}
              />
              Actualizar
            </button>
          </div>
        </header>

        {error && <div className="admin-error-banner">{error}</div>}

        {data && (
          <>
            <div className="dashboard-filter-note">
              <CalendarDays size={15} />
              <span>
                {data.filter.selectedEvent
                  ? `Mostrando ${data.filter.selectedEvent.name} · ${eventDate(data.filter.selectedEvent.startsAt)}`
                  : "Mostrando acumulado de todos los sábados"}
              </span>
            </div>

            <section className="dashboard-primary-metrics">
              <article className="dashboard-metric revenue">
                <div className="dashboard-metric-icon">
                  <CircleDollarSign size={21} />
                </div>
                <span>Ingresos</span>
                <strong>{money.format(data.metrics.revenueCents / 100)}</strong>
                <small>{data.metrics.effectiveOrders} pedidos efectivos</small>
              </article>

              <article className="dashboard-metric">
                <div className="dashboard-metric-icon">
                  <Package size={21} />
                </div>
                <span>Combos vendidos</span>
                <strong>{data.metrics.combosSold}</strong>
                <small>Pagados y no reembolsados</small>
              </article>

              <article className="dashboard-metric">
                <div className="dashboard-metric-icon">
                  <CupSoda size={21} />
                </div>
                <span>Coca-Colas vendidas</span>
                <strong>{data.metrics.cokesSold}</strong>
                <small>Latas dentro de ventas efectivas</small>
              </article>

              <article className="dashboard-metric">
                <div className="dashboard-metric-icon">
                  <Ticket size={21} />
                </div>
                <span>Ticket promedio</span>
                <strong>
                  {money.format(data.metrics.averageTicketCents / 100)}
                </strong>
                <small>Promedio por pedido efectivo</small>
              </article>
            </section>

            <section className="dashboard-secondary-metrics">
              <article>
                <XCircle size={18} />
                <div>
                  <span>Cancelados</span>
                  <strong>{data.metrics.cancelledOrders}</strong>
                </div>
              </article>
              <article>
                <RotateCcw size={18} />
                <div>
                  <span>Reembolsados</span>
                  <strong>{data.metrics.refundedOrders}</strong>
                </div>
              </article>
              <article>
                <UserX size={18} />
                <div>
                  <span>No recogidos</span>
                  <strong>{data.metrics.noShowOrders}</strong>
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="admin-kicker">Preferencias</p>
                    <h2>Extras más vendidos</h2>
                  </div>
                  <span>{data.topExtras.length} extras</span>
                </div>

                {data.topExtras.length === 0 ? (
                  <div className="dashboard-empty">
                    Todavía no hay extras vendidos en este periodo.
                  </div>
                ) : (
                  <div className="dashboard-ranking">
                    {data.topExtras.map((extra, index) => (
                      <div className="dashboard-ranking-row" key={extra.name}>
                        <span className="dashboard-rank">{index + 1}</span>
                        <div className="dashboard-ranking-main">
                          <div>
                            <strong>{extra.name}</strong>
                            <span>
                              {extra.quantity} vendido
                              {extra.quantity === 1 ? "" : "s"} ·{" "}
                              {money.format(extra.revenueCents / 100)}
                            </span>
                          </div>
                          <div className="dashboard-bar">
                            <span
                              style={{
                                width:
                                  Math.max(
                                    5,
                                    Math.round(
                                      (extra.quantity / maxExtraQuantity) * 100,
                                    ),
                                  ) + "%",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="dashboard-panel">
                <div className="dashboard-panel-head">
                  <div>
                    <p className="admin-kicker">Histórico</p>
                    <h2>Ventas por sábado</h2>
                  </div>
                  <span>Últimos 8 con ventas</span>
                </div>

                {data.salesByEvent.length === 0 ? (
                  <div className="dashboard-empty">
                    Todavía no hay ventas pagadas para mostrar.
                  </div>
                ) : (
                  <div className="dashboard-event-list">
                    {data.salesByEvent.map((event) => (
                      <div className="dashboard-event-row" key={event.id}>
                        <div className="dashboard-event-copy">
                          <strong>{eventDate(event.startsAt)}</strong>
                          <span>
                            {event.combosSold} combos · {event.paidOrders} pedidos
                          </span>
                        </div>
                        <div className="dashboard-event-value">
                          <strong>{money.format(event.revenueCents / 100)}</strong>
                          <div className="dashboard-bar">
                            <span
                              style={{
                                width:
                                  Math.max(
                                    5,
                                    Math.round(
                                      (event.revenueCents / maxEventRevenue) * 100,
                                    ),
                                  ) + "%",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <p className="dashboard-footnote">
              “Ingresos”, combos, Coca-Colas y ticket promedio consideran
              pedidos pagados que no estén cancelados ni reembolsados. Los
              pedidos NO_SHOW siguen contando como venta mientras no exista un
              reembolso.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
