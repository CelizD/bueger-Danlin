import {
  CheckCircle2,
  PackageCheck,
} from "lucide-react";
import type { DeliveryOrder } from "../delivery/types";

const money = new Intl.NumberFormat(
  "es-MX",
  {
    style: "currency",
    currency: "MXN",
  },
);

function deliveryFeeLabel(
  order: DeliveryOrder,
) {
  const finalFee =
    order.groupDeliveryFinalFeeCents;

  if (finalFee === null) {
    return "Pendiente de cierre";
  }

  if (finalFee <= 0) {
    return "Envío gratis";
  }

  if (order.groupDeliveryFeeCollectedAt) {
    return `Cobrado ${money.format(
      (order.groupDeliveryFeeCollectedCents ??
        finalFee) / 100,
    )}`;
  }

  return `Cobrar ${money.format(
    finalFee / 100,
  )} en efectivo`;
}

function deliveryButtonLabel(
  order: DeliveryOrder,
  busy: boolean,
) {
  if (busy) {
    return "Confirmando…";
  }

  const fee =
    order.groupDeliveryFinalFeeCents ?? 0;

  if (
    fee > 0 &&
    !order.groupDeliveryFeeCollectedAt
  ) {
    return `Cobrar ${money.format(
      fee / 100,
    )} y entregar`;
  }

  return "Confirmar entrega";
}

export function DeliveryOrderSections({
  query,
  ready,
  delivered,
  busyCode,
  onDeliver,
}: {
  query: string;
  ready: DeliveryOrder[];
  delivered: DeliveryOrder[];
  busyCode: string | null;
  onDeliver: (
    order: DeliveryOrder,
  ) => void;
}) {
  return (
    <>
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
              {query
                ? "No encontramos un pedido listo con esa búsqueda."
                : "No hay pedidos listos todavía."}
            </div>
          ) : (
            ready.map((order) => (
              <article
                className="delivery-card"
                key={order.id}
              >
                <div className="delivery-card-top">
                  <div>
                    <span>Código</span>
                    <strong>
                      {order.orderCode}
                    </strong>
                  </div>
                  <div className="delivery-ready-badge">
                    LISTO
                  </div>
                </div>

                <div className="delivery-customer">
                  <strong>
                    {order.customer.name}
                  </strong>
                  <span>
                    {order.customer.phone}
                  </span>
                </div>

                <div className="delivery-meta">
                  <div>
                    <span>Combos</span>
                    <strong>
                      {order.comboQuantity}
                    </strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>
                      {money.format(
                        order.totalCents /
                          100,
                      )}
                    </strong>
                  </div>
                  <div
                    className={
                      "delivery-fee-meta" +
                      ((order.groupDeliveryFinalFeeCents ?? 0) > 0 &&
                      !order.groupDeliveryFeeCollectedAt
                        ? " cash-due"
                        : "")
                    }
                  >
                    <span>Envío</span>
                    <strong>
                      {deliveryFeeLabel(
                        order,
                      )}
                    </strong>
                  </div>
                </div>

                <button
                  className="delivery-confirm"
                  type="button"
                  onClick={() =>
                    onDeliver(order)
                  }
                  disabled={
                    busyCode ===
                    order.orderCode
                  }
                >
                  <CheckCircle2
                    size={18}
                  />
                  {deliveryButtonLabel(
                    order,
                    busyCode ===
                      order.orderCode,
                  )}
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
          <span>
            {delivered.length}
          </span>
        </div>

        <div className="delivery-history-list">
          {delivered
            .slice(0, 20)
            .map((order) => (
              <div
                className="delivery-history-row"
                key={order.id}
              >
                <strong>
                  {order.orderCode}
                </strong>
                <span>
                  {order.customer.name}
                </span>
                <span>
                  {order.customer.phone}
                </span>
                <b>
                  {order.comboQuantity}{" "}
                  combo(s)
                </b>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
