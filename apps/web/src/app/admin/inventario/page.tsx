"use client";

import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarDays,
  ChefHat,
  LogOut,
  PackageCheck,
  RefreshCw,
  Save,
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  Truck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
};

export default function InventoryPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { stock: string; threshold: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  async function saveItem(item: InventoryItem) {
    const draft = drafts[item.id];
    if (!draft) return;

    const stockQuantity = Number(draft.stock);
    const lowStockThreshold = Number(draft.threshold);

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
          body: JSON.stringify({ stockQuantity, lowStockThreshold }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo guardar el inventario.");
      }

      setSuccess(`${item.name} actualizado correctamente.`);
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
        throw new Error(data.message || "No se pudo actualizar el artículo.");
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
              Controla el stock disponible y evita vender ingredientes agotados.
            </p>
          </div>

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
          “Disponible ahora” ya considera lo reservado por pedidos pendientes.
          Si una reserva vence o se cancela, esas unidades regresan automáticamente.
        </div>

        <section className="inventory-list">
          {items.map((item) => {
            const draft = drafts[item.id] ?? {
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
                    <span>{item.unit}</span>
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

                <div className="inventory-fields">
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

                <div className="inventory-actions">
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
                    {item.active ? "Desactivar control" : "Activar control"}
                  </button>

                  <button
                    className="inventory-save"
                    type="button"
                    onClick={() => void saveItem(item)}
                    disabled={busyId === item.id}
                  >
                    <Save size={16} />
                    {busyId === item.id ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
