"use client";

import { AdminDeliveryGroups } from "@/features/staff/components/admin-delivery-groups";
import { AdminOrderList } from "@/features/staff/components/admin-order-list";
import { AdminOrderMetrics } from "@/features/staff/components/admin-order-metrics";
import { AdminOrdersToolbar } from "@/features/staff/components/admin-orders-toolbar";
import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { useAdminOrders } from "@/features/staff/orders/use-admin-orders";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { money } from "@/features/staff/orders/config";

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
    success,
    refundingOrderCode,
    filteredOrders,
    load,
    setQuery,
    setStatus,
    selectEvent,
    toggleExpanded,
    refundLatePayment,
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

        {success && (
          <div className="saturday-success">
            {success}
          </div>
        )}

        {(data?.summary.manualRefundsPending ?? 0) > 0 && (
          <div className="admin-refund-banner" role="alert">
            <AlertTriangle size={21} />
            <div>
              <strong>
                {data!.summary.manualRefundsPending} reembolso
                {data!.summary.manualRefundsPending === 1 ? "" : "s"} pendiente
                {data!.summary.manualRefundsPending === 1 ? "" : "s"}
              </strong>
              <span>
                {money.format(
                  data!.summary.manualRefundsPendingCents / 100,
                )} recibidos en pagos tardíos necesitan devolución.
              </span>
            </div>
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
            refundingOrderCode={
              refundingOrderCode
            }
            onToggle={toggleExpanded}
            onRefundLatePayment={(
              order,
            ) => {
              void refundLatePayment(
                order,
              );
            }}
          />
        </section>
      </section>
    </main>
  );
}
