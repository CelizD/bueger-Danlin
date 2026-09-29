import {
  ChefHat,
  Clock3,
  PackageCheck,
} from "lucide-react";
import type {
  KitchenColumns,
  KitchenOrder,
} from "../kitchen/types";
import { KitchenOrderCard } from "./kitchen-order-card";

const columns = [
  {
    key: "NEW" as const,
    title: "Nuevos",
    empty: "Sin pedidos nuevos.",
  },
  {
    key: "PREPARING" as const,
    title: "Preparando",
    empty: "Nada en preparación.",
  },
  {
    key: "READY" as const,
    title: "Listos",
    empty:
      "Todavía no hay pedidos listos.",
  },
];

export function KitchenBoard({
  data,
  busyCode,
  onTransition,
}: {
  data: KitchenColumns;
  busyCode: string | null;
  onTransition: (
    order: KitchenOrder,
    next: "preparing" | "ready",
  ) => void;
}) {
  return (
    <>
      <section className="kitchen-stats">
        <div>
          <Clock3 size={17} />
          <span>Nuevos</span>
          <strong>
            {data.NEW.length}
          </strong>
        </div>
        <div>
          <ChefHat size={17} />
          <span>Preparando</span>
          <strong>
            {data.PREPARING.length}
          </strong>
        </div>
        <div>
          <PackageCheck size={17} />
          <span>Listos</span>
          <strong>
            {data.READY.length}
          </strong>
        </div>
      </section>

      <section className="kitchen-board">
        {columns.map((column) => (
          <div
            className="kitchen-column"
            key={column.key}
          >
            <div className="kitchen-column-head">
              <span>{column.title}</span>
              <strong>
                {
                  data[column.key]
                    .length
                }
              </strong>
            </div>

            <div className="kitchen-column-list">
              {data[column.key]
                .length ? (
                data[column.key].map(
                  (order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      busy={
                        busyCode ===
                        order.orderCode
                      }
                      onTransition={
                        onTransition
                      }
                    />
                  ),
                )
              ) : (
                <div className="kitchen-empty">
                  {column.empty}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
