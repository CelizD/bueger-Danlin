"use client";

import {
  CheckCircle2,
  ChefHat,
  LogOut,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
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

type DeliveryOrder = {
  id: string;
  orderCode: string;
  status: "READY" | "DELIVERED";
  comboQuantity: number;
  totalCents: number;
  deliveredAt?: string | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  pickupEvent: {
    locationLabel: string;
    startsAt: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
  }>;
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export default function DeliveryPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [query, setQuery] = useState("");
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

      if (!me.ok || !["ADMIN", "DELIVERY"].includes(meData.user.role)) {
        window.location.replace("/admin/login");
        return;
      }

      setUser(meData.user);

      const response = await fetch(`${API_URL}/staff/delivery/orders`, {
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        window.location.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("No se pudieron cargar los pedidos de entrega.");
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return orders;

    return orders.filter(
      (order) =>
        order.orderCode.toLowerCase().includes(normalized) ||
        order.customer.name.toLowerCase().includes(normalized) ||
        order.customer.phone.includes(normalized),
    );
  }, [orders, query]);

  const ready = filtered.filter((order) => order.status === "READY");
  const delivered = filtered.filter((order) => order.status === "DELIVERED");

  async function markDelivered(order: DeliveryOrder) {
    setBusyCode(order.orderCode);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/staff/delivery/orders/${encodeURIComponent(order.orderCode)}/delivered`,
        {
          method: "PATCH",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo marcar como entregado.");
      }

      await load();
    } catch (deliveryError) {
      setError(
        deliveryError instanceof Error
          ? deliveryError.message
          : "No se pudo marcar como entregado.",
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
    return <main className="admin-loading">Cargando entregas…</main>;
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">BD</div>
            <div>
              <strong>Burger Danlin</strong>
              <span>Entrega</span>
            </div>
          </div>

          <nav className="admin-nav">
            {user?.role === "ADMIN" && (
              <a href="/admin/pedidos">
                <ShoppingBag size={18} strokeWidth={1.8} />
                Pedidos
              </a>
            )}
            {user?.role === "ADMIN" && (
              <a href="/admin/cocina">
                <ChefHat size={18} strokeWidth={1.8} />
                Cocina
              </a>
            )}
            <a className="active" href="/admin/entrega">
              <Truck size={18} strokeWidth={1.8} />
              Entrega
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

      <section className="admin-content delivery-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-kicker">Punto de entrega</p>
            <h1>Entrega</h1>
            <p>Busca el pedido y confirma la entrega al cliente.</p>
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

        <section className="delivery-search-card">
          <div className="delivery-search-input">
            <Search size={21} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Código H-..., nombre o teléfono"
            />
          </div>
          <div className="delivery-search-count">
            <strong>{ready.length}</strong>
            <span>listos para entregar</span>
          </div>
        </section>

        <section className="delivery-section">
          <div className="delivery-section-head">
            <div>
              <PackageCheck size={18} />
              <h2>Listos</h2>
            </div>
            <span>{ready.length}</span>
          </div>

          <div className="delivery-grid">
            {ready.length === 0 ? (
              <div className="delivery-empty">
                {query ? "No encontramos un pedido listo con esa búsqueda." : "No hay pedidos listos todavía."}
              </div>
            ) : (
              ready.map((order) => (
                <article className="delivery-card" key={order.id}>
                  <div className="delivery-card-top">
                    <div>
                      <span>Código</span>
                      <strong>{order.orderCode}</strong>
                    </div>
                    <div className="delivery-ready-badge">LISTO</div>
                  </div>

                  <div className="delivery-customer">
                    <strong>{order.customer.name}</strong>
                    <span>{order.customer.phone}</span>
                  </div>

                  <div className="delivery-meta">
                    <div>
                      <span>Combos</span>
                      <strong>{order.comboQuantity}</strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>{money.format(order.totalCents / 100)}</strong>
                    </div>
                  </div>

                  <button
                    className="delivery-confirm"
                    type="button"
                    onClick={() => void markDelivered(order)}
                    disabled={busyCode === order.orderCode}
                  >
                    <CheckCircle2 size={18} />
                    {busyCode === order.orderCode
                      ? "Confirmando…"
                      : "Confirmar entrega"}
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="delivery-section delivered-history">
          <div className="delivery-section-head">
            <div>
              <CheckCircle2 size={18} />
              <h2>Entregados</h2>
            </div>
            <span>{delivered.length}</span>
          </div>

          <div className="delivery-history-list">
            {delivered.slice(0, 20).map((order) => (
              <div className="delivery-history-row" key={order.id}>
                <strong>{order.orderCode}</strong>
                <span>{order.customer.name}</span>
                <span>{order.customer.phone}</span>
                <b>{order.comboQuantity} combo(s)</b>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
