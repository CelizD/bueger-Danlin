"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { KitchenBoard } from "@/features/staff/components/kitchen-board";
import { useAdminKitchen } from "@/features/staff/kitchen/use-admin-kitchen";
import { RefreshCw } from "lucide-react";

export default function KitchenPage() {
  const {
    user,
    columns,
    loading,
    refreshing,
    busyCode,
    error,
    load,
    transition,
  } = useAdminKitchen();

  if (loading) {
    return (
      <main className="admin-loading">
        Cargando cocina…
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="cocina"
        subtitle="Cocina"
      />

      <section className="admin-content kitchen-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Producción del sábado
            </p>
            <h1>Cocina</h1>
            <p>
              Los pedidos se actualizan
              automáticamente cada 15
              segundos.
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

        <KitchenBoard
          data={columns}
          busyCode={busyCode}
          onTransition={(
            order,
            next,
          ) => {
            void transition(
              order,
              next,
            );
          }}
        />
      </section>
    </main>
  );
}
