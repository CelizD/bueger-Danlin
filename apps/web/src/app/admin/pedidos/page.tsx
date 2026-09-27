"use client";

import {
  AdminDeliveryGroups,
  type AdminDeliveryGroup,
} from "@/features/staff/components/admin-delivery-groups";
import { AdminSidebar } from "@/features/staff/components/admin-sidebar";
import { API_URL, apiFetch } from "@/lib/api/browser";
import {
  Boxes,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChefHat,
  CircleDollarSign,
  LogOut,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type StaffUser = {
  id?: string;
  sub?: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

type OrderModifier = {
  id: string;
  optionName: string;
  priceDeltaCents: number;
  quantity: number;
  removed: boolean;
};

type OrderItem = {
  id: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  modifiers: OrderModifier[];
};

type AdminOrder = {
  id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  comboQuantity: number;
  groupDeliveryFinalFeeCents: number | null;
  groupDeliveryFinalizedAt: string | null;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  pickupEvent: {
    id: string;
    code: string;
    name: string;
    locationLabel: string;
    startsAt: string;
    closesAt: string;
    timezone: string;
    pickupPoint: {
      id: string;
      code: string;
      name: string;
      address: string | null;
    };
  };
  items: OrderItem[];
  statusHistory: Array<{
    id: string;
    from: string | null;
    to: string;
    note: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    provider: string;
    status: string;
    amountCents: number;
    paidAt: string | null;
  }>;
};

type OrdersResponse = {
  summary: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalCombos: number;
    paidRevenueCents: number;
    finalDeliveryCashCents: number;
    activeGroups: number;
  };
  groups: AdminDeliveryGroup[];
  orders: AdminOrder[];
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NO_SHOW: "No recogido",
};

export default function AdminOrdersPage() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);

    try {
      const meResponse = await apiFetch(`${API_URL}/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });

      if (meResponse.status === 401) {
        window.location.replace("/admin/login");
        return;
      }

      if (!meResponse.ok) {
        throw new Error("No se pudo validar la sesión.");
      }

      const meData = await meResponse.json();
      setUser(meData.user);

      const ordersResponse = await apiFetch(`${API_URL}/admin/orders`, {
        credentials: "include",
        cache: "no-store",
      });

      if (ordersResponse.status === 401 || ordersResponse.status === 403) {
        window.location.replace("/admin/login");
        return;
      }

      if (!ordersResponse.ok) {
        throw new Error("No se pudieron cargar los pedidos.");
      }

      setData(await ordersResponse.json());
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
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (
      data?.orders.filter((order) => {
        const matchesStatus =
          status === "ALL" ||
          order.status === status ||
          order.paymentStatus === status;

        const matchesGroup =
          selectedEventId === null ||
          order.pickupEvent.id === selectedEventId;

        const matchesQuery =
          !normalizedQuery ||
          order.orderCode.toLowerCase().includes(normalizedQuery) ||
          order.customer.name.toLowerCase().includes(normalizedQuery) ||
          order.customer.phone.includes(normalizedQuery) ||
          order.pickupEvent.pickupPoint.name
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesStatus && matchesGroup && matchesQuery;
      }) ?? []
    );
  }, [data, query, selectedEventId, status]);

  async function logout() {
    await apiFetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    window.location.replace("/admin/login");
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">Cargando pedidos…</div>
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
            <p className="admin-kicker">Operación del sábado</p>
            <h1>Pedidos</h1>
            <p>
              Revisa pedidos por punto, progreso grupal y cobros de envío.
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

        <section className="admin-metrics admin-metrics-four">
          <article>
            <ShoppingBag size={19} strokeWidth={1.7} />
            <span>Pedidos</span>
            <strong>{data?.summary.totalOrders ?? 0}</strong>
          </article>
          <article>
            <Package size={19} strokeWidth={1.7} />
            <span>Combos pagados</span>
            <strong>{data?.summary.totalCombos ?? 0}</strong>
          </article>
          <article>
            <CircleDollarSign size={19} strokeWidth={1.7} />
            <span>Venta pagada</span>
            <strong>
              {money.format((data?.summary.paidRevenueCents ?? 0) / 100)}
            </strong>
          </article>
          <article>
            <Truck size={19} strokeWidth={1.7} />
            <span>Envío por cobrar</span>
            <strong>
              {money.format(
                (data?.summary.finalDeliveryCashCents ?? 0) / 100,
              )}
            </strong>
          </article>
        </section>

        <AdminDeliveryGroups
          groups={data?.groups ?? []}
          selectedEventId={selectedEventId}
          onSelect={(eventId) => {
            setSelectedEventId(eventId);
            setExpanded(null);
          }}
        />

        <section className="admin-orders-section">
          <div className="admin-orders-toolbar">
            <div className="admin-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar código, cliente, teléfono o punto"
              />
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrar pedidos por estado"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PAID">Pagados</option>
              <option value="PENDING">Pendientes de pago</option>
              <option value="PREPARING">Preparando</option>
              <option value="READY">Listos</option>
              <option value="DELIVERED">Entregados</option>
              <option value="CANCELLED">Cancelados</option>
              <option value="REFUNDED">Reembolsados</option>
            </select>
          </div>

          <div className="admin-order-list">
            {filteredOrders.length === 0 ? (
              <div className="admin-empty">
                No hay pedidos que coincidan con este filtro.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isOpen = expanded === order.id;
                const statusText =
                  statusLabel[order.status] ?? order.status.toLowerCase();

                return (
                  <article
                    className={`admin-order-row ${isOpen ? "open" : ""}`}
                    key={order.id}
                  >
                    <button
                      className="admin-order-summary"
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : order.id)}
                    >
                      <div className="admin-order-code">
                        <strong>{order.orderCode}</strong>
                        <span>
                          {new Date(order.createdAt).toLocaleString("es-MX", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>

                      <div className="admin-order-customer">
                        <strong>{order.customer.name}</strong>
                        <span>{order.customer.phone}</span>
                      </div>

                      <div className="admin-order-count">
                        <strong>{order.comboQuantity}</strong>
                        <span>{order.pickupEvent.pickupPoint.name}</span>
                      </div>

                      <div className="admin-order-total">
                        <strong>{money.format(order.totalCents / 100)}</strong>
                        <span>{order.paymentStatus === "PAID" ? "Pagado" : "Pendiente"}</span>
                      </div>

                      <div className={`admin-status status-${order.status.toLowerCase()}`}>
                        {statusText}
                      </div>

                      <ChevronDown
                        size={18}
                        className={isOpen ? "admin-chevron open" : "admin-chevron"}
                      />
                    </button>

                    {isOpen && (
                      <div className="admin-order-detail">
                        <div className="admin-detail-meta">
                          <div>
                            <span>Cliente</span>
                            <strong>{order.customer.name}</strong>
                            <small>{order.customer.email || "Sin correo"}</small>
                          </div>
                          <div>
                            <span>Entrega</span>
                            <strong>
                              {order.pickupEvent.pickupPoint.name}
                            </strong>
                            <small>
                              {order.pickupEvent.pickupPoint.address ||
                                "Sin dirección registrada"}
                            </small>
                            <small>
                              {new Date(order.pickupEvent.startsAt).toLocaleString(
                                "es-MX",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                },
                              )}
                            </small>
                          </div>
                        </div>

                        <div className="admin-delivery-charge">
                          <div>
                            <span>Envío grupal</span>
                            <strong>
                              {order.groupDeliveryFinalizedAt
                                ? order.groupDeliveryFinalFeeCents === 0
                                  ? "Envío gratis"
                                  : money.format(
                                      (order.groupDeliveryFinalFeeCents ?? 0) /
                                        100,
                                    )
                                : order.paymentStatus === "PAID"
                                  ? "Pendiente de cierre"
                                  : "No cuenta hasta pagar"}
                            </strong>
                          </div>
                          <small>
                            {order.groupDeliveryFinalizedAt
                              ? order.groupDeliveryFinalFeeCents === 0
                                ? "El grupo alcanzó la meta. No cobres envío."
                                : "Cobrar este monto en efectivo al entregar."
                              : "El cargo definitivo se congela al cerrar el punto."}
                          </small>
                        </div>

                        <div className="admin-items">
                          {order.items.map((item, itemIndex) => (
                            <div className="admin-item" key={item.id}>
                              <div className="admin-item-head">
                                <strong>
                                  {item.productName}
                                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                                </strong>
                                <span>{money.format(item.lineTotalCents / 100)}</span>
                              </div>

                              {item.modifiers.length > 0 && (
                                <div className="admin-modifiers">
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
                              )}

                              {item.modifiers.length === 0 &&
                                item.productName.toLowerCase().includes("combo") && (
                                  <small className="admin-complete-note">
                                    Hamburguesa completa
                                  </small>
                                )}
                            </div>
                          ))}
                        </div>

                        {order.statusHistory.length > 0 && (
                          <div className="admin-history">
                            <span className="admin-history-title">Historial</span>
                            {order.statusHistory.map((entry) => (
                              <div className="admin-history-row" key={entry.id}>
                                <span>
                                  {entry.from ? statusLabel[entry.from] ?? entry.from : "Creado"}
                                  {" → "}
                                  {statusLabel[entry.to] ?? entry.to}
                                </span>
                                <small>{entry.note || "Cambio de estado"}</small>
                                <time>
                                  {new Date(entry.createdAt).toLocaleString("es-MX", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </time>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
