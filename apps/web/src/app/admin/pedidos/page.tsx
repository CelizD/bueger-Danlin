"use client";

import { AdminDeliveryGroups } from "@/features/staff/components/admin-delivery-groups";
import { AdminOrderList } from "@/features/staff/components/admin-order-list";
import { AdminOrderMetrics } from "@/features/staff/components/admin-order-metrics";
import { AdminOrdersToolbar } from "@/features/staff/components/admin-orders-toolbar";
import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { useAdminOrders } from "@/features/staff/orders/use-admin-orders";
import { RefreshCw } from "lucide-react";

export default function AdminOrdersPage() {
  const {
    user,
    data,
    loading,
    refreshing,
    query,
    status,
    selectedEventId,
    expanded,
    error,
    filteredOrders,
    load,
    setQuery,
    setStatus,
    selectEvent,
    toggleExpanded,
  } = useAdminOrders();

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">
          Cargando pedidos…
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="pedidos"
        subtitle="Operaciones"
      />

      <section className="admin-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Operación del sábado
            </p>
            <h1>Pedidos</h1>
            <p>
              Revisa pedidos por punto,
              progreso grupal y cobros de
              envío.
            </p>
          </div>

          <button
            className="admin-refresh"
            type="button"
            onClick={() =>
              void load(true)
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
        </header>

        {error && (
          <div className="admin-error-banner">
            {error}
          </div>
        )}

        <AdminOrderMetrics
          summary={data?.summary}
        />

        <AdminDeliveryGroups
          groups={data?.groups ?? []}
          selectedEventId={
            selectedEventId
          }
          onSelect={selectEvent}
        />

        <section className="admin-orders-section">
          <AdminOrdersToolbar
            query={query}
            status={status}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
          />

          <AdminOrderList
            orders={filteredOrders}
            expanded={expanded}
            onToggle={toggleExpanded}
          />
        </section>
      </section>
    </main>
  );
}
