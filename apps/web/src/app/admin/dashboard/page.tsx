"use client";

import { AdminDashboardAnalysis } from "@/features/staff/components/admin-dashboard-analysis";
import { AdminDashboardMetrics } from "@/features/staff/components/admin-dashboard-metrics";
import { AdminDayPanel } from "@/features/staff/components/admin-day-panel";
import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { dashboardEventDate } from "@/features/staff/dashboard/formatters";
import { useAdminDashboard } from "@/features/staff/dashboard/use-admin-dashboard";
import {
  CalendarDays,
  RefreshCw,
} from "lucide-react";

export default function DashboardPage() {
  const {
    user,
    data,
    selectedEventId,
    loading,
    refreshing,
    error,
    maxExtraQuantity,
    maxEventRevenue,
    load,
    changeEvent,
  } = useAdminDashboard();

  if (loading && !data) {
    return (
      <main className="admin-loading">
        Cargando dashboard…
      </main>
    );
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
            <p className="admin-kicker">
              Operación y ventas
            </p>
            <h1>Panel del día</h1>
            <p>
              Lo que tienes que preparar,
              cobrar y entregar hoy, con
              el histórico debajo.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <select
              value={selectedEventId}
              onChange={(event) => {
                void changeEvent(
                  event.target.value,
                );
              }}
              aria-label="Filtrar panel por entrega"
            >
              <option value="ALL">
                Todos los sábados
              </option>
              {data?.filter.events.map(
                (event) => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {dashboardEventDate(
                      event.startsAt,
                    )}{" "}
                    ·{" "}
                    {event.locationLabel}
                  </option>
                ),
              )}
            </select>

            <button
              className="admin-refresh"
              type="button"
              onClick={() =>
                void load(
                  selectedEventId,
                  true,
                )
              }
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "admin-spin"
                    : undefined
                }
              />
              Actualizar
            </button>
          </div>
        </header>

        {error && (
          <div className="admin-error-banner">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="dashboard-filter-note">
              <CalendarDays
                size={15}
              />
              <span>
                {data.filter.selectedEvent
                  ? `Mostrando ${data.filter.selectedEvent.name} · ${dashboardEventDate(data.filter.selectedEvent.startsAt)}`
                  : "Mostrando acumulado de todos los sábados"}
              </span>
            </div>

            <AdminDayPanel
              day={data.day}
            />

            <div className="dashboard-history-heading">
              <div>
                <p className="admin-kicker">
                  Análisis
                </p>
                <h2>
                  Rendimiento e histórico
                </h2>
              </div>
              <span>
                {data.filter.selectedEvent
                  ? "Entrega seleccionada"
                  : "Acumulado general"}
              </span>
            </div>

            <AdminDashboardMetrics
              metrics={data.metrics}
            />

            <AdminDashboardAnalysis
              data={data}
              maxExtraQuantity={
                maxExtraQuantity
              }
              maxEventRevenue={
                maxEventRevenue
              }
            />

            <p className="dashboard-footnote">
              “Ingresos”, combos,
              Coca-Colas y ticket promedio
              consideran pedidos pagados
              que no estén cancelados ni
              reembolsados. Los pedidos
              NO_SHOW siguen contando como
              venta mientras no exista un
              reembolso.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
