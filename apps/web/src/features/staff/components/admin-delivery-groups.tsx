"use client";

import {
  CheckCircle2,
  MapPin,
  Truck,
  Package,
  Wallet,
} from "lucide-react";

export type AdminDeliveryGroup = {
  eventId: string;
  eventCode: string;
  eventName: string;
  status: string;
  startsAt: string;
  closesAt: string;
  pickupPoint: {
    id: string;
    code: string;
    name: string;
    address: string | null;
  };
  minPaidCombos: number;
  paidComboCount: number;
  remainingPaidCombos: number;
  transportCostCents: number;
  estimatedFeeCents: number | null;
  freeDeliveryUnlocked: boolean;
  finalized: boolean;
  finalizedAt: string | null;
  finalAssignedCents: number | null;
  cashToCollectCents: number;
};

type Props = {
  groups: AdminDeliveryGroup[];
  selectedEventId: string | null;
  onSelect: (eventId: string | null) => void;
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function dateLabel(group: AdminDeliveryGroup) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Tijuana",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(group.startsAt));
}

function progressIcons(group: AdminDeliveryGroup) {
  const goal = Math.min(Math.max(group.minPaidCombos, 1), 10);
  const filled = Math.min(group.paidComboCount, goal);

  return Array.from({ length: goal }, (_, index) =>
    index < filled ? "🍔" : "⬜",
  ).join("");
}

export function AdminDeliveryGroups({
  groups,
  selectedEventId,
  onSelect,
}: Props) {
  return (
    <section
      className="admin-delivery-groups"
      aria-labelledby="admin-delivery-groups-title"
    >
      <div className="admin-delivery-groups-head">
        <div>
          <p className="admin-kicker">Entrega por ubicación</p>
          <h2 id="admin-delivery-groups-title">
            Grupos de entrega
          </h2>
          <p>
            Revisa la meta, traslado y cobro de cada punto.
          </p>
        </div>

        <button
          type="button"
          className={
            selectedEventId === null
              ? "admin-group-all active"
              : "admin-group-all"
          }
          onClick={() => onSelect(null)}
        >
          Ver todos
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="admin-empty">
          Todavía no hay grupos de entrega configurados.
        </div>
      ) : (
        <div className="admin-delivery-group-grid">
          {groups.map((group) => {
            const selected = selectedEventId === group.eventId;

            return (
              <button
                key={group.eventId}
                type="button"
                className={
                  "admin-delivery-group-card" +
                  (selected ? " selected" : "")
                }
                onClick={() => onSelect(group.eventId)}
                aria-pressed={selected}
              >
                <div className="admin-delivery-group-title">
                  <div>
                    <MapPin size={16} />
                    <strong>{group.pickupPoint.name}</strong>
                  </div>
                  <span
                    className={
                      group.finalized
                        ? "admin-group-state finalized"
                        : "admin-group-state live"
                    }
                  >
                    {group.finalized ? "Cerrado" : "En curso"}
                  </span>
                </div>

                <span className="admin-group-date">
                  {dateLabel(group)}
                </span>

                {group.pickupPoint.address && (
                  <small className="admin-group-address">
                    {group.pickupPoint.address}
                  </small>
                )}

                <div className="admin-group-progress">
                  <span aria-hidden="true">
                    {progressIcons(group)}
                  </span>
                  <strong>
                    {group.paidComboCount} de {group.minPaidCombos}
                    {" "}combos pagados
                  </strong>
                </div>

                <div className="admin-group-stats">
                  <div>
                    <Package size={14} />
                    <span>
                      {group.freeDeliveryUnlocked
                        ? "Meta completa"
                        : group.remainingPaidCombos +
                          " combo faltante" +
                          (group.remainingPaidCombos === 1 ? "" : "s")}
                    </span>
                  </div>

                  <div>
                    <Truck size={14} />
                    <span>
                      Traslado{" "}
                      {money.format(group.transportCostCents / 100)}
                    </span>
                  </div>

                  {group.finalized ? (
                    <div>
                      <Wallet size={14} />
                      <span>
                        Cobrar{" "}
                        {money.format(
                          group.cashToCollectCents / 100,
                        )}
                      </span>
                    </div>
                  ) : group.freeDeliveryUnlocked ? (
                    <div>
                      <CheckCircle2 size={14} />
                      <span>Envío estimado $0</span>
                    </div>
                  ) : (
                    <div>
                      <Wallet size={14} />
                      <span>
                        Estimado{" "}
                        {group.estimatedFeeCents === null
                          ? "pendiente"
                          : money.format(
                              group.estimatedFeeCents / 100,
                            ) + " c/u"}
                      </span>
                    </div>
                  )}
                </div>

                {group.finalized && !group.freeDeliveryUnlocked && (
                  <p className="admin-group-final-note">
                    El cargo de cada cliente ya está congelado.
                  </p>
                )}

                {group.finalized && group.freeDeliveryUnlocked && (
                  <p className="admin-group-free-note">
                    Envío gratis confirmado para este grupo.
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
