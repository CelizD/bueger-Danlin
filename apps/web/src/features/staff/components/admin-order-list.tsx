import { ChevronDown } from "lucide-react";
import { money, STATUS_LABELS } from "../orders/config";
import type { AdminOrder } from "../orders/types";
import { AdminOrderDetail } from "./admin-order-detail";

function statusText(status: string) {
  return STATUS_LABELS[status] ?? status.toLowerCase();
}

export function AdminOrderList({
  orders,
  expanded,
  onToggle,
}: {
  orders: AdminOrder[];
  expanded: string | null;
  onToggle: (orderId: string) => void;
}) {
  return (
    <div className="admin-order-list">
      {orders.length === 0 ? (
        <div className="admin-empty">
          No hay pedidos que coincidan con este filtro.
        </div>
      ) : (
        orders.map((order) => {
          const isOpen = expanded === order.id;

          return (
            <article
              className={
                "admin-order-row " +
                (isOpen ? "open" : "")
              }
              key={order.id}
            >
              <button
                className="admin-order-summary"
                type="button"
                onClick={() => onToggle(order.id)}
              >
                <div className="admin-order-code">
                  <strong>{order.orderCode}</strong>
                  <span>
                    {new Date(
                      order.createdAt,
                    ).toLocaleString("es-MX", {
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
                  <span>
                    {order.pickupEvent.pickupPoint.name}
                  </span>
                </div>

                <div className="admin-order-total">
                  <strong>
                    {money.format(order.totalCents / 100)}
                  </strong>
                  <span>
                    {order.paymentStatus === "PAID"
                      ? "Pagado"
                      : "Pendiente"}
                  </span>
                </div>

                <div
                  className={
                    "admin-status status-" +
                    order.status.toLowerCase()
                  }
                >
                  {statusText(order.status)}
                </div>

                <ChevronDown
                  size={18}
                  className={
                    isOpen
                      ? "admin-chevron open"
                      : "admin-chevron"
                  }
                />
              </button>

              {isOpen && (
                <AdminOrderDetail order={order} />
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
