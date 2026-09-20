"use client";

import { API_URL } from "@/lib/api/browser";
import {
  Boxes,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  LogOut,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

type Modifier = {
  id: string;
  optionName: string;
  removed: boolean;
};

type KitchenOrder = {
  id: string;
  orderCode: string;
  status: "PAID" | "CONFIRMED" | "PREPARING" | "READY";
  comboQuantity: number;
  totalCents: number;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    modifiers: Modifier[];
  }>;
};

function statusTitle(status: KitchenOrder["status"]) {
  if (status === "PREPARING") return "Preparando";
  if (status === "READY") return "Listo";
  return "Nuevo";
}

export default function KitchenPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState("");

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

      if (!me.ok || !["ADMIN", "KITCHEN"].includes(meData.user.role)) {
        window.location.replace("/admin/login");
        return;
      }

      setUser(meData.user);

      const response = await fetch(`${API_URL}/staff/kitchen/orders`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        window.location.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("No se pudieron cargar los pedidos de cocina.");
      }

      setOrders(await response.json());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los pedidos.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const columns = useMemo(
    () => ({
      NEW: orders.filter(
        (order) => order.status === "PAID" || order.status === "CONFIRMED",
      ),
      PREPARING: orders.filter((order) => order.status === "PREPARING"),
      READY: orders.filter((order) => order.status === "READY"),
    }),
    [orders],
  );

  async function transition(
    order: KitchenOrder,
    next: "preparing" | "ready",
  ) {
    setBusyCode(order.orderCode);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/staff/kitchen/orders/${encodeURIComponent(order.orderCode)}/${next}`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo actualizar el pedido.");
      }

      await load();
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : "No se pudo actualizar el pedido.",
      );
    } finally {
      setBusyCode(null);
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
    return <main className="admin-loading">Cargando cocina…</main>;
  }

  const renderCard = (order: KitchenOrder) => (
    <article className="kitchen-card" key={order.id}>
      <div className="kitchen-card-head">
        <div>
          <strong>{order.orderCode}</strong>
          <span>{order.customer.name}</span>
        </div>
        <div className="kitchen-combo-count">
          {order.comboQuantity} combo{order.comboQuantity === 1 ? "" : "s"}
        </div>
      </div>

      <div className="kitchen-items">
        {order.items.map((item) => (
          <div className="kitchen-item" key={item.id}>
            <div className="kitchen-item-name">
              <strong>{item.productName}</strong>
              {item.quantity > 1 && <span>× {item.quantity}</span>}
            </div>

            {item.modifiers.length > 0 ? (
              <div className="kitchen-modifiers">
                {item.modifiers.map((modifier) => (
                  <span
                    key={modifier.id}
                    className={modifier.removed ? "removed" : "extra"}
                  >
                    {modifier.removed ? "Sin " : "+ "}
                    {modifier.optionName}
                  </span>
                ))}
              </div>
            ) : item.productName.toLowerCase().includes("combo") ? (
              <small>Completa</small>
            ) : null}
          </div>
        ))}
      </div>

      <div className="kitchen-card-footer">
        <span>{statusTitle(order.status)}</span>
        {(order.status === "PAID" || order.status === "CONFIRMED") && (
          <button
            type="button"
            onClick={() => void transition(order, "preparing")}
            disabled={busyCode === order.orderCode}
          >
            <ChefHat size={16} />
            {busyCode === order.orderCode ? "Actualizando…" : "Preparar"}
          </button>
        )}
        {order.status === "PREPARING" && (
          <button
            type="button"
            onClick={() => void transition(order, "ready")}
            disabled={busyCode === order.orderCode}
          >
            <CheckCircle2 size={16} />
            {busyCode === order.orderCode ? "Actualizando…" : "Marcar listo"}
          </button>
        )}
        {order.status === "READY" && (
          <span className="kitchen-ready-label">
            <PackageCheck size={16} /> Esperando entrega
          </span>
        )}
      </div>
    </article>
  );

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">BD</div>
            <div>
              <strong>Burger Danlin</strong>
              <span>Cocina</span>
            </div>
          </div>

          <nav className="admin-nav">
            {user?.role === "ADMIN" && (
              <a href="/admin/dashboard">
                <BarChart3 size={18} strokeWidth={1.8} />
                Dashboard
              </a>
            )}
            {user?.role === "ADMIN" && (
              <a href="/admin/pedidos">
                <ShoppingBag size={18} strokeWidth={1.8} />
                Pedidos
              </a>
            )}
            <a className="active" href="/admin/cocina">
              <ChefHat size={18} strokeWidth={1.8} />
              Cocina
            </a>
            {user?.role === "ADMIN" && (
              <a href="/admin/entrega">
                <Truck size={18} strokeWidth={1.8} />
                Entrega
              </a>
            )}
            {user?.role === "ADMIN" && (
              <a href="/admin/sabados">
                <CalendarDays size={18} strokeWidth={1.8} />
                Sábados
              </a>
            )}
            {user?.role === "ADMIN" && (
              <a href="/admin/inventario">
                <Boxes size={18} strokeWidth={1.8} />
                Inventario
              </a>
            )}
            {user?.role === "ADMIN" && (
              <a href="/admin/personal">
                <Users size={18} strokeWidth={1.8} />
                Personal
              </a>
            )}
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

      <section className="admin-content kitchen-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">Producción del sábado</p>
            <h1>Cocina</h1>
            <p>Los pedidos se actualizan automáticamente cada 15 segundos.</p>
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

        <section className="kitchen-stats">
          <div><Clock3 size={17} /><span>Nuevos</span><strong>{columns.NEW.length}</strong></div>
          <div><ChefHat size={17} /><span>Preparando</span><strong>{columns.PREPARING.length}</strong></div>
          <div><PackageCheck size={17} /><span>Listos</span><strong>{columns.READY.length}</strong></div>
        </section>

        <section className="kitchen-board">
          <div className="kitchen-column">
            <div className="kitchen-column-head">
              <span>Nuevos</span>
              <strong>{columns.NEW.length}</strong>
            </div>
            <div className="kitchen-column-list">
              {columns.NEW.length ? columns.NEW.map(renderCard) : <div className="kitchen-empty">Sin pedidos nuevos.</div>}
            </div>
          </div>

          <div className="kitchen-column">
            <div className="kitchen-column-head">
              <span>Preparando</span>
              <strong>{columns.PREPARING.length}</strong>
            </div>
            <div className="kitchen-column-list">
              {columns.PREPARING.length ? columns.PREPARING.map(renderCard) : <div className="kitchen-empty">Nada en preparación.</div>}
            </div>
          </div>

          <div className="kitchen-column">
            <div className="kitchen-column-head">
              <span>Listos</span>
              <strong>{columns.READY.length}</strong>
            </div>
            <div className="kitchen-column-list">
              {columns.READY.length ? columns.READY.map(renderCard) : <div className="kitchen-empty">Todavía no hay pedidos listos.</div>}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
