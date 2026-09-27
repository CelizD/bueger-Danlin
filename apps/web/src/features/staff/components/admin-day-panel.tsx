"use client";

import {
  Banknote,
  ChefHat,
  Clock3,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";

export type AdminDayPanelData = {
  date: string | null;
  startsAt: string | null;
  metrics: {
    totalOrders: number;
    paidOrders: number;
    pendingPaymentOrders: number;
    combosToPrepare: number;
    readyCombos: number;
    receivedCents: number;
    deliveryCashToCollectCents: number;
  };
  groups: Array<{
    eventId: string;
    eventCode: string;
    status: string;
    startsAt: string;
    closesAt: string;
    pickupPoint: {
      id: string;
      code: string;
      name: string;
      address: string | null;
    };
    activeOrders: number;
    paidOrders: number;
    combosPaid: number;
    combosToPrepare: number;
    readyCombos: number;
    minPaidOrders: number;
    remainingPaidOrders: number;
    transportCostCents: number;
    estimatedFeeCents: number | null;
    freeDeliveryUnlocked: boolean;
    finalized: boolean;
    finalizedAt: string | null;
    cashToCollectCents: number;
  }>;
  deliveryCharges: Array<{
    orderId: string;
    orderCode: string;
    customerName: string;
    customerPhone: string;
    pickupPointName: string;
    finalized: boolean;
    freeDeliveryUnlocked: boolean;
    finalFeeCents: number | null;
    estimatedFeeCents: number | null;
  }>;
};

type Props = {
  day: AdminDayPanelData | null;
};

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function dateLabel(value: string | null) {
  if (!value) return "Sin fecha operativa";

  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Tijuana",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export function AdminDayPanel({ day }: Props) {
  if (!day) {
    return (
      <section className="admin-day-panel">
        <div className="admin-empty">
          No hay una entrega disponible para mostrar en el Panel del día.
        </div>
      </section>
    );
  }

  return (
    <section
      className="admin-day-panel"
      aria-labelledby="admin-day-panel-title"
    >
      <div className="admin-day-panel-head">
        <div>
          <p className="admin-kicker">Operación actual</p>
          <h2 id="admin-day-panel-title">Panel del día</h2>
          <p>{dateLabel(day.startsAt)}</p>
        </div>
        <span>
          {day.groups.length} punto
          {day.groups.length === 1 ? "" : "s"} de entrega
        </span>
      </div>

      <div className="admin-day-metrics">
        <article>
          <ShoppingBag size={19} />
          <span>Pedidos activos</span>
          <strong>{day.metrics.totalOrders}</strong>
          <small>
            {day.metrics.paidOrders} pagados ·{" "}
            {day.metrics.pendingPaymentOrders} pendientes
          </small>
        </article>

        <article>
          <ChefHat size={19} />
          <span>Hamburguesas por preparar</span>
          <strong>{day.metrics.combosToPrepare}</strong>
          <small>{day.metrics.readyCombos} ya listas</small>
        </article>

        <article>
          <Banknote size={19} />
          <span>Dinero recibido</span>
          <strong>
            {money.format(day.metrics.receivedCents / 100)}
          </strong>
          <small>Solo pedidos pagados y vigentes</small>
        </article>

        <article>
          <Truck size={19} />
          <span>Envío por cobrar</span>
          <strong>
            {money.format(
              day.metrics.deliveryCashToCollectCents / 100,
            )}
          </strong>
          <small>Solo cargos finales ya congelados</small>
        </article>
      </div>

      <div className="admin-day-grid">
        <article className="admin-day-section">
          <div className="admin-day-section-head">
            <div>
              <p className="admin-kicker">Por punto</p>
              <h3>Operación de entregas</h3>
            </div>
            <MapPin size={18} />
          </div>

          <div className="admin-day-group-list">
            {day.groups.map((group) => (
              <div className="admin-day-group-row" key={group.eventId}>
                <div className="admin-day-group-copy">
                  <strong>{group.pickupPoint.name}</strong>
                  <span>
                    {group.paidOrders} de {group.minPaidOrders} pagados
                  </span>
                  {group.pickupPoint.address && (
                    <small>{group.pickupPoint.address}</small>
                  )}
                </div>

                <div className="admin-day-group-numbers">
                  <span>
                    <Users size={13} />
                    {group.activeOrders} pedidos
                  </span>
                  <span>
                    <ChefHat size={13} />
                    {group.combosToPrepare} por preparar
                  </span>
                  <span>
                    <PackageCheck size={13} />
                    {group.readyCombos} listas
                  </span>
                </div>

                <div className="admin-day-group-delivery">
                  {group.finalized ? (
                    <>
                      <strong>
                        {group.freeDeliveryUnlocked
                          ? "Envío gratis"
                          : money.format(
                              group.cashToCollectCents / 100,
                            ) + " por cobrar"}
                      </strong>
                      <small>Cargo final congelado</small>
                    </>
                  ) : group.freeDeliveryUnlocked ? (
                    <>
                      <strong>Meta completa</strong>
                      <small>Envío estimado $0</small>
                    </>
                  ) : (
                    <>
                      <strong>
                        {group.estimatedFeeCents === null
                          ? "Estimado pendiente"
                          : money.format(
                              group.estimatedFeeCents / 100,
                            ) + " c/u"}
                      </strong>
                      <small>
                        Faltan {group.remainingPaidOrders} pedido
                        {group.remainingPaidOrders === 1 ? "" : "s"}
                      </small>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-day-section">
          <div className="admin-day-section-head">
            <div>
              <p className="admin-kicker">Cobro en entrega</p>
              <h3>Envío por cliente</h3>
            </div>
            <Clock3 size={18} />
          </div>

          {day.deliveryCharges.length === 0 ? (
            <div className="dashboard-empty">
              Todavía no hay pedidos pagados para mostrar.
            </div>
          ) : (
            <div className="admin-day-charge-list">
              {day.deliveryCharges.map((charge) => {
                const amount = charge.finalized
                  ? charge.finalFeeCents
                  : charge.estimatedFeeCents;
                const label = charge.finalized
                  ? charge.freeDeliveryUnlocked
                    ? "Gratis"
                    : "Final"
                  : charge.freeDeliveryUnlocked
                    ? "Estimado $0"
                    : "Estimado";

                return (
                  <div
                    className="admin-day-charge-row"
                    key={charge.orderId}
                  >
                    <div>
                      <strong>{charge.customerName}</strong>
                      <span>
                        {charge.pickupPointName} · {charge.orderCode}
                      </span>
                      <small>{charge.customerPhone}</small>
                    </div>

                    <div className="admin-day-charge-amount">
                      <span>{label}</span>
                      <strong>
                        {amount === null
                          ? "Pendiente"
                          : money.format(amount / 100)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
