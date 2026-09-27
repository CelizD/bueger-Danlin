"use client";

import { GroupDeliveryProgress } from "@/features/ordering/components/group-delivery-progress";
import { API_URL, apiFetch } from "@/lib/api/browser";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type CustomerOrder = {
  orderCode: string;
  status: string;
  paymentStatus: string;
  currency: string;
  totalCents: number;
  comboQuantity: number;
  createdAt: string;
  cancelledAt: string | null;
  canCancel: boolean;
  cancellationDeadline: string;
  refundStatus: "PENDING" | "REFUNDED" | null;
  pickup: {
    locationLabel: string;
    startsAt: string;
    closesAt: string;
    timezone: string;
    pickupPoint: {
      code: string;
      name: string;
      address: string | null;
    };
  };
  groupDelivery: {
    minPaidOrders: number;
    paidOrderCount: number;
    remainingPaidOrders: number;
    transportCostCents: number;
    estimatedDeliveryFeeCents: number | null;
    freeDeliveryUnlocked: boolean;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: Array<{
      id: string;
      optionName: string;
      removed: boolean;
      priceDeltaCents: number;
    }>;
  }>;
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
  READY: "Listo para recoger",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Cancelado y reembolsado",
  NO_SHOW: "No recogido",
};

export default function CustomerOrderPage() {
  const params = useParams<{ orderCode: string }>();
  const orderCode = decodeURIComponent(params.orderCode ?? "").toUpperCase();

  const [token, setToken] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const hashToken = hash.startsWith("#token=")
      ? decodeURIComponent(hash.slice("#token=".length))
      : "";

    const storageKey = `burger-danlin:order-token:${orderCode}`;
    const savedToken = window.sessionStorage.getItem(storageKey) ?? "";
    const resolvedToken = hashToken || savedToken;

    if (hashToken) {
      window.sessionStorage.setItem(storageKey, hashToken);
      window.history.replaceState(null, "", window.location.pathname);
    }

    setToken(resolvedToken);

    if (!resolvedToken) {
      setLoading(false);
      setError(
        "Este navegador no tiene el acceso seguro de este pedido. Abre el enlace original que recibiste al comprar.",
      );
      return;
    }

    void loadOrder(resolvedToken);
  }, [orderCode]);

  async function loadOrder(orderToken = token) {
    if (!orderToken) return;

    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `${API_URL}/orders/${encodeURIComponent(orderCode)}`,
        {
          headers: {
            "x-order-token": orderToken,
          },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo consultar el pedido.");
      }

      setOrder(data as CustomerOrder);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo consultar el pedido.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder() {
    if (!order || !token || !order.canCancel) return;

    const confirmed = window.confirm(
      order.paymentStatus === "PAID"
        ? "¿Seguro que quieres cancelar? Se iniciará el reembolso del pago."
        : "¿Seguro que quieres cancelar? El cupo reservado se liberará.",
    );

    if (!confirmed) return;

    setCanceling(true);
    setError("");
    setNotice("");

    try {
      const response = await apiFetch(
        `${API_URL}/orders/${encodeURIComponent(order.orderCode)}/cancel`,
        {
          method: "POST",
          headers: {
            "x-order-token": token,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(" ")
          : data.message;
        throw new Error(message || "No se pudo cancelar el pedido.");
      }

      setNotice(
        data.refundStatus === "REFUNDED"
          ? "Pedido cancelado. El reembolso local ya fue completado."
          : data.refundStatus === "PENDING"
            ? "Pedido cancelado. Tu reembolso quedó solicitado."
            : "Pedido cancelado. El cupo fue liberado.",
      );

      await loadOrder(token);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "No se pudo cancelar el pedido.",
      );
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <main className="customer-order-shell">
        <div className="customer-order-loading" role="status" aria-live="polite">
          Consultando pedido…
        </div>
      </main>
    );
  }

  return (
    <main className="customer-order-shell">
      <div className="customer-order-page">
        <a href="/" className="customer-order-back">
          <ArrowLeft size={16} />
          Volver al menú
        </a>

        {error && (
          <div className="alert" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        {order && (
          <>
            <header className="customer-order-header">
              <div>
                <p className="eyebrow">Mi pedido</p>
                <h1>{order.orderCode}</h1>
                <p>
                  Consulta el estado, la entrega y las opciones disponibles
                  para este pedido.
                </p>
              </div>

              <span
                className={
                  "customer-order-status status-" +
                  order.status.toLowerCase()
                }
              >
                {statusLabel[order.status] ?? order.status}
              </span>
            </header>

            {notice && (
              <div className="customer-cancel-success" role="status" aria-live="polite">
                <CheckCircle2 size={18} aria-hidden="true" />
                {notice}
              </div>
            )}

            <section className="customer-order-summary">
              <article>
                <Package size={18} />
                <span>Total</span>
                <strong>{money.format(order.totalCents / 100)}</strong>
              </article>
              <article>
                <CalendarDays size={18} />
                <span>Entrega</span>
                <strong>
                  {new Intl.DateTimeFormat("es-MX", {
                    timeZone: order.pickup.timezone,
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(order.pickup.startsAt))}
                </strong>
              </article>
              <article>
                <MapPin size={18} />
                <span>Lugar</span>
                <strong>{order.pickup.pickupPoint.name}</strong>
                {order.pickup.pickupPoint.address && (
                  <small>{order.pickup.pickupPoint.address}</small>
                )}
              </article>
            </section>

            <GroupDeliveryProgress
              group={order.groupDelivery}
              pointName={order.pickup.pickupPoint.name}
              paymentStatus={order.paymentStatus}
            />

            <section className="customer-order-items">
              <div className="customer-order-section-head">
                <div>
                  <p className="eyebrow">Detalle</p>
                  <h2>Tu orden</h2>
                </div>
                <span>{order.comboQuantity} combo(s)</span>
              </div>

              <div className="customer-order-item-list">
                {order.items.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>
                        {item.productName}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </strong>
                      <span>{money.format(item.lineTotalCents / 100)}</span>
                    </div>

                    {item.modifiers.length > 0 && (
                      <div className="customer-order-modifiers">
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
                  </article>
                ))}
              </div>
            </section>

            <section className="customer-cancel-card">
              <div className="customer-cancel-card-head">
                <div className="customer-cancel-card-icon">
                  {order.canCancel ? (
                    <RotateCcw size={21} />
                  ) : (
                    <ShieldCheck size={21} />
                  )}
                </div>
                <div>
                  <strong>
                    {order.status === "REFUNDED"
                      ? "Reembolso completado"
                      : order.status === "CANCELLED"
                        ? "Pedido cancelado"
                        : order.canCancel
                          ? "Cancelación disponible"
                          : "Cancelaciones cerradas"}
                  </strong>
                  <span>
                    {order.status === "REFUNDED"
                      ? "El pago de este pedido ya fue marcado como reembolsado."
                      : order.refundStatus === "PENDING"
                        ? "El pedido está cancelado y el reembolso sigue en proceso."
                        : order.canCancel
                          ? "Puedes cancelar hasta la hora límite del viernes."
                          : "La fecha límite para cancelar ya terminó o el pedido ya fue finalizado."}
                  </span>
                </div>
              </div>

              <div className="customer-cancel-deadline">
                <span>Fecha límite</span>
                <strong>
                  {new Intl.DateTimeFormat("es-MX", {
                    timeZone: order.pickup.timezone,
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(order.cancellationDeadline))}
                </strong>
              </div>

              {order.canCancel && (
                <button
                  type="button"
                  className="customer-cancel-button"
                  onClick={cancelOrder}
                  disabled={canceling}
                >
                  <XCircle size={17} />
                  {canceling
                    ? "Cancelando pedido…"
                    : order.paymentStatus === "PAID"
                      ? "Cancelar e iniciar reembolso"
                      : "Cancelar pedido"}
                </button>
              )}
            </section>

            <p className="technical-note">
              Pago: {order.paymentStatus}
              {order.refundStatus === "PENDING" && " · Reembolso en proceso"}
              {order.refundStatus === "REFUNDED" && " · Reembolso completado"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
