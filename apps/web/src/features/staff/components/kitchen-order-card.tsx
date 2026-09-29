import {
  CheckCircle2,
  ChefHat,
  PackageCheck,
} from "lucide-react";
import { kitchenStatusTitle } from "../kitchen/selectors";
import type { KitchenOrder } from "../kitchen/types";

export function KitchenOrderCard({
  order,
  busy,
  onTransition,
}: {
  order: KitchenOrder;
  busy: boolean;
  onTransition: (
    order: KitchenOrder,
    next: "preparing" | "ready",
  ) => void;
}) {
  return (
    <article className="kitchen-card">
      <div className="kitchen-card-head">
        <div>
          <strong>
            {order.orderCode}
          </strong>
          <span>
            {order.customer.name}
          </span>
        </div>

        <div className="kitchen-combo-count">
          {order.comboQuantity} combo
          {order.comboQuantity === 1
            ? ""
            : "s"}
        </div>
      </div>

      <div className="kitchen-items">
        {order.items.map((item) => (
          <div
            className="kitchen-item"
            key={item.id}
          >
            <div className="kitchen-item-name">
              <strong>
                {item.productName}
              </strong>
              {item.quantity > 1 && (
                <span>
                  × {item.quantity}
                </span>
              )}
            </div>

            {item.modifiers.length >
            0 ? (
              <div className="kitchen-modifiers">
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
                      {
                        modifier.optionName
                      }
                    </span>
                  ),
                )}
              </div>
            ) : item.productName
                .toLowerCase()
                .includes("combo") ? (
              <small>Completa</small>
            ) : null}
          </div>
        ))}
      </div>

      <div className="kitchen-card-footer">
        <span>
          {kitchenStatusTitle(
            order.status,
          )}
        </span>

        {(order.status === "PAID" ||
          order.status ===
            "CONFIRMED") && (
          <button
            type="button"
            onClick={() =>
              onTransition(
                order,
                "preparing",
              )
            }
            disabled={busy}
          >
            <ChefHat size={16} />
            {busy
              ? "Actualizando…"
              : "Preparar"}
          </button>
        )}

        {order.status ===
          "PREPARING" && (
          <button
            type="button"
            onClick={() =>
              onTransition(
                order,
                "ready",
              )
            }
            disabled={busy}
          >
            <CheckCircle2
              size={16}
            />
            {busy
              ? "Actualizando…"
              : "Marcar listo"}
          </button>
        )}

        {order.status ===
          "READY" && (
          <span className="kitchen-ready-label">
            <PackageCheck
              size={16}
            />
            Esperando entrega
          </span>
        )}
      </div>
    </article>
  );
}
