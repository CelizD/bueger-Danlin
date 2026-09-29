import type { PickupEvent } from "../types";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function deliveryDate(event: PickupEvent) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: event.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startsAt));
}

function progressIcons(event: PickupEvent) {
  const goal = Math.min(
    Math.max(event.groupDelivery.minPaidCombos, 1),
    10,
  );
  const filled = Math.min(
    event.groupDelivery.paidComboCount,
    goal,
  );

  return Array.from({ length: goal }, (_, index) =>
    index < filled ? "🍔" : "⬜",
  ).join("");
}

type Props = {
  events: PickupEvent[];
  selectedEventId: string | null;
  onSelect: (event: PickupEvent) => void;
};

export function PickupPointSelector({
  events,
  selectedEventId,
  onSelect,
}: Props) {
  if (events.length === 0) return null;

  return (
    <section className="pickup-selector" aria-labelledby="pickup-selector-title">
      <div className="pickup-selector-head">
        <div>
          <p className="eyebrow">Punto de entrega</p>
          <h2 id="pickup-selector-title">¿Dónde quieres recibir tu pedido?</h2>
        </div>
        <span>{events.length} punto{events.length === 1 ? "" : "s"} disponible{events.length === 1 ? "" : "s"}</span>
      </div>

      <div className="pickup-point-grid">
        {events.map((event) => {
          const selected = selectedEventId === event.id;
          const soldOut = event.status === "SOLD_OUT";
          const group = event.groupDelivery;

          return (
            <article
              className={
                "pickup-point-card" +
                (selected ? " selected" : "") +
                (soldOut ? " sold-out" : "")
              }
              key={event.id}
            >
              <div className="pickup-point-card-head">
                <div>
                  <strong>{event.pickupPoint.name}</strong>
                  <span>{deliveryDate(event)}</span>
                </div>
                {selected && <span className="pickup-selected-badge">Elegido</span>}
              </div>

              {event.pickupPoint.address && (
                <p className="pickup-address">{event.pickupPoint.address}</p>
              )}

              <div className="pickup-group-progress" aria-label={`${group.paidComboCount} de ${group.minPaidCombos} combos pagados`}>
                <span className="pickup-burgers" aria-hidden="true">
                  {progressIcons(event)}
                </span>
                <strong>
                  {group.paidComboCount} de {group.minPaidCombos} combos pagados
                </strong>
              </div>

              <div className="pickup-delivery-status">
                {group.freeDeliveryUnlocked ? (
                  <strong className="free">Envío gratis desbloqueado</strong>
                ) : (
                  <>
                    <span>
                      Faltan {group.remainingPaidCombos} combo{group.remainingPaidCombos === 1 ? "" : "s"} para envío gratis
                    </span>
                    <strong>
                      {group.estimatedDeliveryFeeCents === null
                        ? "Costo por persona pendiente del primer pedido pagado"
                        : `Envío estimado ahora: ${money.format(
                            group.estimatedDeliveryFeeCents / 100,
                          )}`}
                    </strong>
                  </>
                )}
              </div>

              <button
                type="button"
                className="pickup-select-button"
                onClick={() => onSelect(event)}
                disabled={soldOut}
                aria-pressed={selected}
              >
                {soldOut
                  ? "Punto agotado"
                  : selected
                    ? "Punto seleccionado"
                    : `Elegir ${event.pickupPoint.name}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
