import {
  CalendarDays,
  Clock3,
  Package,
} from "lucide-react";
import {
  formatShortDateTime,
} from "../saturdays/date-utils";
import type { PickupEvent } from "../saturdays/types";

export function SaturdayOverview({
  activeEvent,
}: {
  activeEvent: PickupEvent | null;
}) {
  return (
    <section className="saturday-overview">
      <article>
        <CalendarDays size={19} />
        <span>Fecha activa</span>
        <strong>
          {activeEvent
            ? activeEvent.name
            : "Sin fecha abierta"}
        </strong>
      </article>
      <article>
        <Package size={19} />
        <span>Disponibles</span>
        <strong>
          {activeEvent
            ? activeEvent.remainingCombos +
              " / " +
              activeEvent.maxCombos
            : "—"}
        </strong>
      </article>
      <article>
        <Clock3 size={19} />
        <span>Cierre actual</span>
        <strong>
          {activeEvent
            ? formatShortDateTime(
                activeEvent.closesAt,
              )
            : "—"}
        </strong>
      </article>
    </section>
  );
}
