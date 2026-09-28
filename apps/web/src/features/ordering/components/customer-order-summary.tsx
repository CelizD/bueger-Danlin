import {
  CalendarDays,
  MapPin,
  Package,
} from "lucide-react";
import { customerOrderMoney } from "../customer-order/config";
import type { CustomerOrder } from "../customer-order/types";

export function CustomerOrderSummary({
  order,
}: {
  order: CustomerOrder;
}) {
  return (
    <section className="customer-order-summary">
      <article>
        <Package size={18} />
        <span>Total</span>
        <strong>
          {customerOrderMoney.format(
            order.totalCents / 100,
          )}
        </strong>
      </article>

      <article>
        <CalendarDays size={18} />
        <span>Entrega</span>
        <strong>
          {new Intl.DateTimeFormat(
            "es-MX",
            {
              timeZone:
                order.pickup.timezone,
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            },
          ).format(
            new Date(
              order.pickup.startsAt,
            ),
          )}
        </strong>
      </article>

      <article>
        <MapPin size={18} />
        <span>Lugar</span>
        <strong>
          {
            order.pickup.pickupPoint
              .name
          }
        </strong>
        {order.pickup.pickupPoint
          .address && (
          <small>
            {
              order.pickup
                .pickupPoint.address
            }
          </small>
        )}
      </article>
    </section>
  );
}
