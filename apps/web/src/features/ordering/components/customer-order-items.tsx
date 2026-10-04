import { customerOrderMoney } from "../customer-order/config";
import type { CustomerOrder } from "../customer-order/types";

export function CustomerOrderItems({
  order,
}: {
  order: CustomerOrder;
}) {
  return (
    <section className="customer-order-items">
      <div className="customer-order-section-head">
        <div>
          <p className="eyebrow">
            Detalle
          </p>
          <h2>Tu orden</h2>
        </div>
        <span>
          {order.comboQuantity} combo(s)
        </span>
      </div>

      <div className="customer-order-item-list">
        {order.items.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.productName}
                {item.quantity > 1
                  ? ` × ${item.quantity}`
                  : ""}
              </strong>
              <span>
                {customerOrderMoney.format(
                  item.lineTotalCents /
                    100,
                )}
              </span>
            </div>

            {item.preparationSnapshot
              ?.quantities ? (
              <div className="customer-order-modifiers">
                {[
                  ...item.preparationSnapshot
                    .quantities,
                  ...(item
                    .preparationSnapshot
                    .sauces ?? []),
                  ...(item
                    .preparationSnapshot
                    .others ?? []),
                ].map((value) => (
                  <span
                    key={value}
                    className="extra"
                  >
                    {value}
                  </span>
                ))}
              </div>
            ) : item.modifiers.length >
              0 ? (
              <div className="customer-order-modifiers">
                {item.modifiers.map(
                  (modifier) => (
                    <span
                      key={
                        modifier.id
                      }
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
                      {!modifier.removed &&
                        modifier.quantity > 1
                        ? ` × ${modifier.quantity}`
                        : ""}
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
