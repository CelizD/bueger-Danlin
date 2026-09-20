"use client";

import { API_URL } from "@/lib/api/browser";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  ChefHat,
  Link2,
  LogOut,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

type InventoryItem = {
  id: string;
  key: string;
  name: string;
  unit: string;
  stockQuantity: number;
  lowStockThreshold: number;
  active: boolean;
  lowStock: boolean;
  outOfStock: boolean;
  linkedToSales: boolean;
  hasHistory: boolean;
  deletable: boolean;
};

type Draft = {
  name: string;
  unit: string;
  stock: string;
  threshold: string;
};

export default function InventoryPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createUnit, setCreateUnit] = useState("unidad");
  const [createStock, setCreateStock] = useState("0");
  const [createThreshold, setCreateThreshold] = useState("5");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);

    try {
      const me = await fetch(`${API_URL}/auth/me`, {
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

      const response = await fetch(`${API_URL}/admin/inventory`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar el inventario.");
      }

      const data = (await response.json()) as InventoryItem[];
      setItems(data);
      setDrafts(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              name: item.name,
              unit: item.unit,
              stock: String(item.stockQuantity),
              threshold: String(item.lowStockThreshold),
            },
          ]),
        ),
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el inventario.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(
    () => ({
      total: items.filter((item) => item.active).length,
      low: items.filter((item) => item.lowStock && !item.outOfStock).length,
      out: items.filter((item) => item.outOfStock).length,
    }),
    [items],
  );

  function resetCreateForm() {
    setCreateName("");
    setCreateUnit("unidad");
    setCreateStock("0");
    setCreateThreshold("5");
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const stockQuantity = Number(createStock);
    const lowStockThreshold = Number(createThreshold);

    if (!createName.trim() || !createUnit.trim()) {
      setError("Nombre y unidad son obligatorios.");
      return;
    }

    if (
      !Number.isInteger(stockQuantity) ||
      stockQuantity < 0 ||
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setError("Stock y alerta deben ser números enteros mayores o iguales a 0.");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/inventory`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          unit: createUnit.trim(),
          stockQuantity,
          lowStockThreshold,
          active: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo crear el artículo.");
      }

      setSuccess(`${data.name} agregado al inventario.`);
      setCreateOpen(false);
      resetCreateForm();
      await load();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear el artículo.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveItem(item: InventoryItem) {
    const draft = drafts[item.id];
    if (!draft) return;

    const stockQuantity = Number(draft.stock);
    const lowStockThreshold = Number(draft.threshold);

    if (!draft.name.trim() || !draft.unit.trim()) {
      setError("Nombre y unidad son obligatorios.");
      return;
    }

    if (
      !Number.isInteger(stockQuantity) ||
      stockQuantity < 0 ||
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setError("Stock y alerta deben ser números enteros mayores o iguales a 0.");
      return;
    }

    setBusyId(item.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/admin/inventory/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            unit: draft.unit.trim(),
            stockQuantity,
            lowStockThreshold,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo guardar el inventario.");
      }

      setSuccess(`${data.name} actualizado correctamente.`);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el inventario.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleItem(item: InventoryItem) {
    setBusyId(item.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/admin/inventory/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: !item.active }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo actualizar el artículo.");
      }

      setSuccess(
        `${item.name} ${!item.active ? "activado" : "desactivado"}.`,
      );
      await load();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar el artículo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(item: InventoryItem) {
    if (!item.deletable) {
      setError(
        item.linkedToSales
          ? "Este artículo está vinculado a ventas. Desactívalo en lugar de eliminarlo."
          : "Este artículo tiene historial y no puede eliminarse.",
      );
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar ${item.name} del inventario? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) return;

    setBusyId(item.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/admin/inventory/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo eliminar el artículo.");
      }

      setSuccess(`${item.name} eliminado del inventario.`);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el artículo.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.replace("/admin/login");
  }

  if (loading) {
    return <main className="admin-loading">Cargando inventario…</main>;
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
            <a href="/admin/dashboard">
              <BarChart3 size={18} strokeWidth={1.8} />
              Dashboard
            </a>
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
            <a href="/admin/sabados">
              <CalendarDays size={18} strokeWidth={1.8} />
              Sábados
            </a>
            <a className="active" href="/admin/inventario">
              <Boxes size={18} strokeWidth={1.8} />
              Inventario
            </a>
            <a href="/admin/personal">
              <Users size={18} strokeWidth={1.8} />
              Personal
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

      <section className="admin-content inventory-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">Existencias</p>
            <h1>Inventario</h1>
            <p>
              Crea artículos, controla existencias y evita vender ingredientes agotados.
            </p>
          </div>

          <div className="inventory-header-actions">
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
              className="inventory-create-button"
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setCreateOpen(true);
              }}
            >
              <Plus size={17} />
              Nuevo artículo
            </button>
          </div>
        </header>

        {error && <div className="admin-error-banner">{error}</div>}
        {success && <div className="saturday-success">{success}</div>}

        <section className="inventory-summary">
          <article>
            <PackageCheck size={19} />
            <span>Artículos activos</span>
            <strong>{summary.total}</strong>
          </article>
          <article>
            <AlertTriangle size={19} />
            <span>Stock bajo</span>
            <strong>{summary.low}</strong>
          </article>
          <article>
            <Boxes size={19} />
            <span>Agotados</span>
            <strong>{summary.out}</strong>
          </article>
        </section>

        <div className="inventory-note">
          Los artículos vinculados a ventas no se pueden eliminar porque forman
          parte de las reglas de consumo o del historial. Puedes desactivarlos
          cuando no quieras controlar su stock.
        </div>

        {createOpen && (
          <section className="inventory-create-card">
            <div className="inventory-create-head">
              <div>
                <p className="admin-kicker">Nuevo registro</p>
                <h2>Agregar artículo</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </div>

            <form className="inventory-create-form" onSubmit={createItem}>
              <label>
                <span>Nombre</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Ej. Pan para hamburguesa"
                />
              </label>

              <label>
                <span>Unidad</span>
                <input
                  required
                  minLength={1}
                  maxLength={40}
                  value={createUnit}
                  onChange={(event) => setCreateUnit(event.target.value)}
                  placeholder="unidad, porción, bolsa…"
                />
              </label>

              <label>
                <span>Stock inicial</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={createStock}
                  onChange={(event) => setCreateStock(event.target.value)}
                />
              </label>

              <label>
                <span>Alerta de stock bajo</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={createThreshold}
                  onChange={(event) => setCreateThreshold(event.target.value)}
                />
              </label>

              <div className="inventory-create-note">
                Los artículos nuevos sirven para llevar existencias manuales. Para
                que un artículo nuevo bloquee una venta debe tener una regla de
                consumo vinculada al producto correspondiente.
              </div>

              <div className="inventory-create-actions">
                <button
                  type="button"
                  className="inventory-secondary"
                  onClick={() => {
                    setCreateOpen(false);
                    resetCreateForm();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inventory-save"
                  disabled={creating}
                >
                  <Plus size={16} />
                  {creating ? "Creando…" : "Agregar artículo"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="inventory-list">
          {items.length === 0 ? (
            <div className="admin-empty">
              No hay artículos. Usa “Nuevo artículo” para crear el primero.
            </div>
          ) : (
            items.map((item) => {
              const draft = drafts[item.id] ?? {
                name: item.name,
                unit: item.unit,
                stock: String(item.stockQuantity),
                threshold: String(item.lowStockThreshold),
              };

              return (
                <article
                  className={
                    "inventory-card " +
                    (item.outOfStock
                      ? "out"
                      : item.lowStock
                        ? "low"
                        : "") +
                    (!item.active ? " inactive" : "")
                  }
                  key={item.id}
                >
                  <div className="inventory-card-head">
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.key}
                        {item.linkedToSales && (
                          <>
                            {" "}
                            · <Link2 size={11} /> Vinculado a ventas
                          </>
                        )}
                      </span>
                    </div>

                    <span
                      className={
                        "inventory-status " +
                        (!item.active
                          ? "disabled"
                          : item.outOfStock
                            ? "out"
                            : item.lowStock
                              ? "low"
                              : "ok")
                      }
                    >
                      {!item.active
                        ? "Sin control"
                        : item.outOfStock
                          ? "Agotado"
                          : item.lowStock
                            ? "Stock bajo"
                            : "Disponible"}
                    </span>
                  </div>

                  <div className="inventory-fields inventory-fields-crud">
                    <label>
                      <span>Nombre</span>
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              name: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label>
                      <span>Unidad</span>
                      <input
                        value={draft.unit}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              unit: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label>
                      <span>Disponible ahora</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.stock}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              stock: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>

                    <label>
                      <span>Alertar cuando queden</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.threshold}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              threshold: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="inventory-actions inventory-actions-crud">
                    <button
                      className="inventory-toggle"
                      type="button"
                      onClick={() => void toggleItem(item)}
                      disabled={busyId === item.id}
                    >
                      {item.active ? (
                        <ToggleLeft size={17} />
                      ) : (
                        <ToggleRight size={17} />
                      )}
                      {item.active ? "Desactivar" : "Activar"}
                    </button>

                    <button
                      className="inventory-delete"
                      type="button"
                      onClick={() => void deleteItem(item)}
                      disabled={busyId === item.id || !item.deletable}
                      title={
                        item.deletable
                          ? "Eliminar artículo"
                          : item.linkedToSales
                            ? "Está vinculado a ventas; desactívalo si ya no lo usarás."
                            : "Tiene historial y no puede eliminarse."
                      }
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>

                    <button
                      className="inventory-save"
                      type="button"
                      onClick={() => void saveItem(item)}
                      disabled={busyId === item.id}
                    >
                      <Save size={16} />
                      {busyId === item.id ? "Guardando…" : "Guardar cambios"}
                    </button>
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
