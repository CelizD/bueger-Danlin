import {
  Clock3,
  Edit3,
  MapPin,
  QrCode,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  formatDate,
  formatDay,
  formatMonth,
  formatShortDateTime,
  statusText,
} from "../saturdays/date-utils";
import type { PickupEvent } from "../saturdays/types";

const money = new Intl.NumberFormat(
  "es-MX",
  {
    style: "currency",
    currency: "MXN",
  },
);

type Props = {
  events: PickupEvent[];
  busyId: string | null;
  onQr: (event: PickupEvent) => void;
  onEdit: (event: PickupEvent) => void;
  onToggle: (event: PickupEvent) => void;
};

export function SaturdayEventList({
  events,
  busyId,
  onQr,
  onEdit,
  onToggle,
}: Props) {
  return (
    <section className="saturday-list">
      {events.length === 0 ? (
        <div className="admin-empty">
          Todavía no hay fechas de entrega. Crea el
          primer sábado.
        </div>
      ) : (
        events.map((event) => {
          const capacityPercent =
            event.maxCombos > 0
              ? Math.min(
                  100,
                  Math.round(
                    (event.reservedCombos /
                      event.maxCombos) *
                      100,
                  ),
                )
              : 0;

          const canToggle =
            event.status !== "COMPLETED" &&
            event.status !== "CANCELLED";

          const isOpen =
            event.status === "OPEN" ||
            event.status === "SOLD_OUT";

          return (
            <article
              className={
                "saturday-card " +
                (isOpen ? "active-event" : "")
              }
              key={event.id}
            >
              <div className="saturday-card-main">
                <div className="saturday-card-date">
                  <span>
                    {formatMonth(
                      event.startsAt,
                    )}
                  </span>
                  <strong>
                    {formatDay(
                      event.startsAt,
                    )}
                  </strong>
                </div>

                <div className="saturday-card-info">
                  <div className="saturday-card-title">
                    <div>
                      <strong>
                        {event.name}
                      </strong>
                      <span>
                        {event.code}
                      </span>
                    </div>
                    <span
                      className={
                        "saturday-status status-" +
                        event.status.toLowerCase()
                      }
                    >
                      {statusText(
                        event.status,
                      )}
                    </span>
                  </div>

                  <div className="saturday-details">
                    <span>
                      <MapPin size={14} />
                      {event.locationLabel}
                    </span>
                    <span>
                      <Clock3 size={14} />
                      {formatDate(
                        event.startsAt,
                      )}
                    </span>
                  </div>

                  <div className="saturday-capacity">
                    <div className="saturday-capacity-head">
                      <span>
                        {event.reservedCombos} de{" "}
                        {event.maxCombos} combos
                        ocupados
                      </span>
                      <strong>
                        {event.remainingCombos}{" "}
                        disponibles
                      </strong>
                    </div>
                    <div className="saturday-progress">
                      <span
                        style={{
                          width:
                            capacityPercent +
                            "%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="saturday-breakdown">
                    <span>
                      Meta:{" "}
                      <b>
                        {
                          event.groupDelivery
                            .minPaidCombos
                        } combos
                      </b>
                    </span>
                    <span>
                      Traslado:{" "}
                      <b>
                        {money.format(
                          event.groupDelivery
                            .transportCostCents /
                            100,
                        )}
                      </b>
                    </span>
                    <span>
                      Envío:{" "}
                      <b>
                        {event.groupDelivery
                          .freeDeliveryUnlocked
                          ? "gratis desbloqueado"
                          : event.groupDelivery
                                .estimatedDeliveryFeeCents ==
                              null
                            ? "pendiente de pedidos pagados"
                            : money.format(
                                event.groupDelivery
                                  .estimatedDeliveryFeeCents /
                                  100,
                              ) +
                              " estimado por pedido"}
                      </b>
                    </span>
                    {event.pickupPoint.address && (
                      <span>
                        Dirección:{" "}
                        <b>
                          {
                            event.pickupPoint
                              .address
                          }
                        </b>
                      </span>
                    )}
                    <span>
                      <b>
                        {event.paidCombos}
                      </b>{" "}
                      combos pagados
                    </span>
                    <span>
                      <b>
                        {
                          event.pendingReservedCombos
                        }
                      </b>{" "}
                      reservados temporalmente
                    </span>
                    <span>
                      Cierre:{" "}
                      <b>
                        {formatShortDateTime(
                          event.closesAt,
                        )}
                      </b>
                    </span>
                  </div>
                </div>
              </div>

              <div className="saturday-card-actions">
                <button
                  type="button"
                  className="saturday-qr"
                  onClick={() =>
                    onQr(event)
                  }
                >
                  <QrCode size={16} />
                  QR del punto
                </button>

                <button
                  type="button"
                  className="saturday-edit"
                  onClick={() =>
                    onEdit(event)
                  }
                  disabled={
                    event.status ===
                      "COMPLETED" ||
                    event.status ===
                      "CANCELLED"
                  }
                >
                  <Edit3 size={16} />
                  Editar
                </button>

                {canToggle && (
                  <button
                    type="button"
                    className={
                      isOpen
                        ? "saturday-toggle close"
                        : "saturday-toggle open"
                    }
                    onClick={() =>
                      onToggle(event)
                    }
                    disabled={
                      busyId === event.id
                    }
                  >
                    {isOpen ? (
                      <ToggleLeft
                        size={18}
                      />
                    ) : (
                      <ToggleRight
                        size={18}
                      />
                    )}
                    {busyId === event.id
                      ? "Actualizando…"
                      : isOpen
                        ? "Cerrar pedidos"
                        : "Abrir pedidos"}
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
