import {
  money,
  STATUS_LABELS,
} from "../orders/config";
import type { AdminOrder } from "../orders/types";
import {
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

function deliveryChargeText(order: AdminOrder) {
  if (order.groupDeliveryFinalizedAt) {
    return order.groupDeliveryFinalFeeCents === 0
      ? "Envío gratis"
      : money.format(
          (order.groupDeliveryFinalFeeCents ?? 0) / 100,
        );
  }

  return order.paymentStatus === "PAID"
    ? "Pendiente de cierre"
    : "No cuenta hasta pagar";
}

function deliveryChargeNote(order: AdminOrder) {
  if (order.groupDeliveryFinalizedAt) {
    return order.groupDeliveryFinalFeeCents === 0
      ? "El grupo alcanzó la meta. No cobres envío."
      : "Cobrar este monto en efectivo al entregar.";
  }

  return "El cargo definitivo se congela al cerrar el punto.";
}

function refundReason(
  reason: string,
) {
  switch (reason) {
    case "RESERVATION_EXPIRED":
      return "El pago llegó después de que venció la reserva de 15 minutos.";
    case "INVENTORY_ALREADY_RELEASED":
      return "El pago llegó cuando el inventario de la reserva ya había sido liberado.";
    case "ORDER_ALREADY_CLOSED":
      return "El pago llegó después de que el pedido ya estaba cerrado o cancelado.";
    default:
      return "El proveedor confirmó el pago cuando el pedido ya no podía aceptarlo.";
  }
}

export function AdminOrderDetail({
  order,
  refunding,
  onRefundLatePayment,
}: {
  order: AdminOrder;
  refunding: boolean;
  onRefundLatePayment: () => void;
}) {
  return (
    <div className="admin-order-detail">
      {order.refundIssue && (
        <section
          className="admin-late-refund-card"
          aria-label="Reembolso pendiente"
        >
          <div className="admin-late-refund-head">
            <AlertTriangle size={21} />
            <div>
              <strong>
                Pago tardío — reembolso requerido
              </strong>
              <span>
                {refundReason(
                  order.refundIssue.reason,
                )}
              </span>
            </div>
          </div>

          <div className="admin-late-refund-meta">
            <div>
              <span>Monto</span>
              <strong>
                {money.format(
                  order.refundIssue.amountCents /
                    100,
                )}
              </strong>
            </div>
            <div>
              <span>Proveedor</span>
              <strong>
                {order.refundIssue.provider}
              </strong>
            </div>
          </div>

          {order.refundIssue.lastAttemptFailed && (
            <p className="admin-late-refund-warning">
              El último intento de reembolso falló. El pago sigue pendiente y se puede reintentar.
            </p>
          )}

          <button
            type="button"
            className="admin-late-refund-button"
            onClick={onRefundLatePayment}
            disabled={refunding}
          >
            <RotateCcw size={17} />
            {refunding
              ? "Procesando reembolso…"
              : "Reembolsar ahora"}
          </button>
        </section>
      )}
      <div className="admin-detail-meta">
        <div>
          <span>Cliente</span>
          <strong>{order.customer.name}</strong>
          <small>
            {order.customer.email || "Sin correo"}
          </small>
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
            {new Date(
              order.pickupEvent.startsAt,
            ).toLocaleString("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </small>
        </div>
      </div>

      <div className="admin-delivery-charge">
        <div>
          <span>Envío grupal</span>
          <strong>
            {deliveryChargeText(order)}
          </strong>
        </div>
        <small>
          {deliveryChargeNote(order)}
        </small>
      </div>

      <div className="admin-items">
        {order.items.map((item) => (
          <div
            className="admin-item"
            key={item.id}
          >
            <div className="admin-item-head">
              <strong>
                {item.productName}
                {item.quantity > 1
                  ? ` × ${item.quantity}`
                  : ""}
              </strong>
              <span>
                {money.format(
                  item.lineTotalCents / 100,
                )}
              </span>
            </div>

            {item.modifiers.length > 0 && (
              <div className="admin-modifiers">
                {item.modifiers.map(
                  (modifier) => (
                    <span
                      key={modifier.id}
                      className={
                        modifier.removed
                          ? "removed"
                          : "extra"
                      }
                    >
                      {modifier.removed
                        ? "Sin "
                        : "+ "}
                      {modifier.optionName}
                      {!modifier.removed &&
                        modifier.quantity > 1
                        ? ` × ${modifier.quantity}`
                        : ""}
                    </span>
                  ),
                )}
              </div>
            )}

            {item.modifiers.length === 0 &&
              item.productName
                .toLowerCase()
                .includes("combo") && (
                <small className="admin-complete-note">
                  Hamburguesa completa
                </small>
              )}
          </div>
        ))}
      </div>

      {order.statusHistory.length > 0 && (
        <div className="admin-history">
          <span className="admin-history-title">
            Historial
          </span>

          {order.statusHistory.map((entry) => (
            <div
              className="admin-history-row"
              key={entry.id}
            >
              <span>
                {entry.from
                  ? STATUS_LABELS[entry.from] ??
                    entry.from
                  : "Creado"}
                {" → "}
                {STATUS_LABELS[entry.to] ??
                  entry.to}
              </span>
              <small>
                {entry.note ||
                  "Cambio de estado"}
              </small>
              <time>
                {new Date(
                  entry.createdAt,
                ).toLocaleString("es-MX", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
