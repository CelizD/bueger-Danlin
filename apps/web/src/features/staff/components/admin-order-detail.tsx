import {
  money,
  STATUS_LABELS,
} from "../orders/config";
import type { AdminOrder } from "../orders/types";

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

export function AdminOrderDetail({
  order,
}: {
  order: AdminOrder;
}) {
  return (
    <div className="admin-order-detail">
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
