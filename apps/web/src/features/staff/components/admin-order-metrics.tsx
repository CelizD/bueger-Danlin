import {
  CircleDollarSign,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { money } from "../orders/config";
import type { OrdersResponse } from "../orders/types";

export function AdminOrderMetrics({
  summary,
}: {
  summary: OrdersResponse["summary"] | null | undefined;
}) {
  return (
    <section className="admin-metrics admin-metrics-four">
      <article>
        <ShoppingBag size={19} strokeWidth={1.7} />
        <span>Pedidos</span>
        <strong>{summary?.totalOrders ?? 0}</strong>
      </article>
      <article>
        <Package size={19} strokeWidth={1.7} />
        <span>Combos pagados</span>
        <strong>{summary?.totalCombos ?? 0}</strong>
      </article>
      <article>
        <CircleDollarSign size={19} strokeWidth={1.7} />
        <span>Venta pagada</span>
        <strong>
          {money.format((summary?.paidRevenueCents ?? 0) / 100)}
        </strong>
      </article>
      <article>
        <Truck size={19} strokeWidth={1.7} />
        <span>Envío por cobrar</span>
        <strong>
          {money.format(
            (summary?.finalDeliveryCashCents ?? 0) / 100,
          )}
        </strong>
      </article>
    </section>
  );
}
