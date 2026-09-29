import {
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { CustomerOrder } from "../customer-order/types";

function title(order: CustomerOrder) {
  if (order.status === "REFUNDED") {
    return "Reembolso completado";
  }

  if (order.status === "CANCELLED") {
    return "Pedido cancelado";
  }

  return order.canCancel
    ? "Cancelación disponible"
    : "Cancelaciones cerradas";
}

function description(
  order: CustomerOrder,
) {
  if (order.status === "REFUNDED") {
    return "El pago de este pedido ya fue marcado como reembolsado.";
  }

  if (
    order.refundStatus === "PENDING"
  ) {
    return "El pedido está cancelado y el reembolso sigue en proceso. Puedes reintentarlo si el proveedor tuvo una falla temporal.";
  }

  return order.canCancel
    ? "Puedes cancelar hasta la hora límite del viernes."
    : "La fecha límite para cancelar ya terminó o el pedido ya fue finalizado.";
}

export function CustomerOrderCancelCard({
  order,
  canceling,
  onCancel,
}: {
  order: CustomerOrder;
  canceling: boolean;
  onCancel: () => void;
}) {
  return (
    <section className="customer-cancel-card">
      <div className="customer-cancel-card-head">
        <div className="customer-cancel-card-icon">
          {order.canCancel ||
          order.refundStatus === "PENDING" ? (
            <RotateCcw size={21} />
          ) : (
            <ShieldCheck size={21} />
          )}
        </div>

        <div>
          <strong>
            {title(order)}
          </strong>
          <span>
            {description(order)}
          </span>
        </div>
      </div>

      <div className="customer-cancel-deadline">
        <span>Fecha límite</span>
        <strong>
          {new Intl.DateTimeFormat(
            "es-MX",
            {
              timeZone:
                order.pickup.timezone,
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
            },
          ).format(
            new Date(
              order.cancellationDeadline,
            ),
          )}
        </strong>
      </div>

      {(order.canCancel ||
        order.refundStatus === "PENDING") && (
        <button
          type="button"
          className="customer-cancel-button"
          onClick={onCancel}
          disabled={canceling}
        >
          <XCircle size={17} />
          {canceling
            ? order.refundStatus ===
                "PENDING"
              ? "Reintentando reembolso…"
              : "Cancelando pedido…"
            : order.refundStatus ===
                "PENDING"
              ? "Reintentar reembolso"
              : order.paymentStatus ===
                  "PAID"
                ? "Cancelar e iniciar reembolso"
                : "Cancelar pedido"}
        </button>
      )}
    </section>
  );
}
