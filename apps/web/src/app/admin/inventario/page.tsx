"use client";

import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { InventoryCreateForm } from "@/features/staff/components/inventory-create-form";
import { InventoryItemList } from "@/features/staff/components/inventory-item-list";
import { InventorySummary } from "@/features/staff/components/inventory-summary";
import { useAdminInventory } from "@/features/staff/inventory/use-admin-inventory";
import {
  Plus,
  RefreshCw,
} from "lucide-react";

export default function InventoryPage() {
  const {
    user,
    items,
    summary,
    loading,
    refreshing,
    busyId,
    creating,
    error,
    success,
    createOpen,
    createForm,
    load,
    openCreate,
    closeCreate,
    setCreateField,
    createItem,
    getDraft,
    setDraftField,
    saveItem,
    toggleItem,
    deleteItem,
  } = useAdminInventory();

  if (loading) {
    return (
      <main className="admin-loading">
        Cargando inventario…
      </main>
    );
  }

  return (
    <main className="admin-page">
      <AdminSidebar
        user={user}
        active="inventario"
        subtitle="Operaciones"
      />

      <section className="admin-content inventory-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">
              Existencias
            </p>
            <h1>Inventario</h1>
            <p>
              Crea artículos, controla
              existencias y evita vender
              ingredientes agotados.
            </p>
          </div>

          <div className="inventory-header-actions">
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
              className="inventory-create-button"
              type="button"
              onClick={openCreate}
            >
              <Plus size={17} />
              Nuevo artículo
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

        <InventorySummary
          total={summary.total}
          low={summary.low}
          out={summary.out}
        />

        <div className="inventory-note">
          Los artículos vinculados a
          ventas no se pueden eliminar
          porque forman parte de las
          reglas de consumo o del
          historial. Puedes
          desactivarlos cuando no
          quieras controlar su stock.
        </div>

        {createOpen && (
          <InventoryCreateForm
            form={createForm}
            creating={creating}
            onChange={setCreateField}
            onClose={closeCreate}
            onSubmit={createItem}
          />
        )}

        <InventoryItemList
          items={items}
          busyId={busyId}
          getDraft={getDraft}
          onDraftChange={
            setDraftField
          }
          onToggle={(item) => {
            void toggleItem(item);
          }}
          onDelete={(item) => {
            void deleteItem(item);
          }}
          onSave={(item) => {
            void saveItem(item);
          }}
        />
      </section>
    </main>
  );
}
