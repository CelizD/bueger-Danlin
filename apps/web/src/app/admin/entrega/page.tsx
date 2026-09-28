"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { DeliveryOrderSections } from "@/features/staff/components/delivery-order-sections";
import { DeliveryScanCard } from "@/features/staff/components/delivery-scan-card";
import { DeliveryScannerModal } from "@/features/staff/components/delivery-scanner-modal";
import { DeliverySearchCard } from "@/features/staff/components/delivery-search-card";
import { useAdminDelivery } from "@/features/staff/delivery/use-admin-delivery";
import {
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

export default function DeliveryPage() {
  const {
    user,
    query,
    loading,
    refreshing,
    busyCode,
    error,
    scanStatus,
    ready,
    delivered,
    scannerOpen,
    videoRef,
    load,
    setQuery,
    markDelivered,
    openScanner,
    closeScanner,
  } = useAdminDelivery();

  if (loading) {
    return (
      <main className="admin-loading">
        Cargando entregas…
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="entrega"
        subtitle="Entrega"
      />

      <section className="admin-content delivery-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Punto de entrega
            </p>
            <h1>Entrega</h1>
            <p>
              Escanea el QR del cliente
              o busca el pedido
              manualmente.
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

        {scanStatus && (
          <div
            className={
              "delivery-scan-result " +
              scanStatus.kind
            }
          >
            <CheckCircle2 size={20} />
            <div>
              <strong>
                {scanStatus.orderCode}
              </strong>
              <span>
                {scanStatus.message}
              </span>
            </div>
          </div>
        )}

        <DeliveryScanCard
          onOpen={openScanner}
        />

        <DeliverySearchCard
          query={query}
          readyCount={ready.length}
          onChange={setQuery}
        />

        <DeliveryOrderSections
          query={query}
          ready={ready}
          delivered={delivered}
          busyCode={busyCode}
          onDeliver={(order) => {
            void markDelivered(order);
          }}
        />
      </section>

      {scannerOpen && (
        <DeliveryScannerModal
          videoRef={videoRef}
          onClose={closeScanner}
        />
      )}
    </main>
  );
}
