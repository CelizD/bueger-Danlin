"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { PickupPointQrModal } from "@/features/staff/components/pickup-point-qr-modal";
import { SaturdayEventForm } from "@/features/staff/components/saturday-event-form";
import { SaturdayEventList } from "@/features/staff/components/saturday-event-list";
import { SaturdayOverview } from "@/features/staff/components/saturday-overview";
import { useAdminSaturdays } from "@/features/staff/saturdays/use-admin-saturdays";
import {
  Plus,
  RefreshCw,
} from "lucide-react";

export default function SaturdaysPage() {
  const {
    user,
    events,
    form,
    editingId,
    formOpen,
    loading,
    saving,
    busyId,
    refreshing,
    error,
    success,
    qrEvent,
    customerOrigin,
    activeEvent,
    deliveryTermsLocked,
    load,
    setFormField,
    openCreate,
    openEdit,
    closeForm,
    save,
    changeOpenState,
    setQrEvent,
  } = useAdminSaturdays();

  if (loading) {
    return (
      <main className="admin-loading">
        Cargando agenda…
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="sabados"
        subtitle="Operaciones"
      />

      <section className="admin-content saturday-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Calendario de ventas
            </p>
            <h1>Agenda</h1>
            <p>
              Gestiona fechas, horarios,
              cupos y puntos de entrega
              desde un solo lugar.
            </p>
          </div>

          <div className="saturday-header-actions">
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

        <SaturdayOverview
          activeEvent={activeEvent}
        />

        {formOpen && (
          <SaturdayEventForm
            editing={editingId != null}
            form={form}
            saving={saving}
            deliveryTermsLocked={
              deliveryTermsLocked
            }
            onChange={setFormField}
            onClose={closeForm}
            onSubmit={save}
          />
        )}

        <SaturdayEventList
          events={events}
          busyId={busyId}
          onQr={setQrEvent}
          onEdit={openEdit}
          onToggle={(event) => {
            void changeOpenState(event);
          }}
        />
      </section>

      {qrEvent && customerOrigin && (
        <PickupPointQrModal
          pointName={
            qrEvent.pickupPoint.name
          }
          pointCode={
            qrEvent.pickupPoint.code
          }
          url={
            customerOrigin +
            "/?pickup=" +
            encodeURIComponent(
              qrEvent.pickupPoint.code,
            )
          }
          onClose={() =>
            setQrEvent(null)
          }
        />
      )}
    </main>
  );
}
