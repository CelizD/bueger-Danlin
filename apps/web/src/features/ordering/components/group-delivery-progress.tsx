import type { GroupDeliveryStatus } from "../types";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type GroupDeliveryProgressProps = {
  group: GroupDeliveryStatus;
  pointName: string;
  paymentStatus: string;
};

function icons(group: GroupDeliveryStatus) {
  const goal = Math.min(Math.max(group.minPaidOrders, 1), 10);
  const filled = Math.min(group.paidOrderCount, goal);

  return Array.from({ length: goal }, (_, index) =>
    index < filled ? "🍔" : "⬜",
  ).join("");
}

export function GroupDeliveryProgress({
  group,
  pointName,
  paymentStatus,
}: GroupDeliveryProgressProps) {
  const paid = paymentStatus === "PAID";
  const missingCopy =
    group.remainingPaidOrders === 1
      ? "Falta 1 pedido para envío gratis"
      : `Faltan ${group.remainingPaidOrders} pedidos para envío gratis`;

  return (
    <section
      className="group-delivery-progress-card"
      aria-labelledby="group-delivery-progress-title"
    >
      <div className="group-delivery-progress-head">
        <div>
          <p className="eyebrow">Envío grupal</p>
          <h2 id="group-delivery-progress-title">{pointName}</h2>
        </div>
        <strong>
          {group.paidOrderCount} de {group.minPaidOrders}
        </strong>
      </div>

      <div
        className="group-delivery-progress-icons"
        aria-label={`${group.paidOrderCount} de ${group.minPaidOrders} pedidos pagados`}
      >
        <span aria-hidden="true">{icons(group)}</span>
        <strong>
          {group.paidOrderCount} de {group.minPaidOrders} pedidos pagados
        </strong>
      </div>

      {group.finalized ? (
        group.freeDeliveryUnlocked ? (
          <div className="group-delivery-free">
            <strong>Envío gratis confirmado</strong>
            <span>El grupo ya cerró y tu cargo final de envío es $0.</span>
          </div>
        ) : (
          <div className="group-delivery-final">
            <strong>Cargo final de envío</strong>
            <span>
              Debes pagar{" "}
              <b>
                {money.format((group.finalFeeCents ?? 0) / 100)}
              </b>{" "}
              en efectivo al momento de la entrega.
            </span>
          </div>
        )
      ) : group.freeDeliveryUnlocked ? (
        <div className="group-delivery-free">
          <strong>Envío gratis desbloqueado</strong>
          <span>Tu cargo estimado de envío es $0.</span>
        </div>
      ) : (
        <div className="group-delivery-pending">
          <strong>{missingCopy}</strong>

          {group.estimatedDeliveryFeeCents === null ? (
            <span>
              El costo por persona se calculará cuando exista al menos un
              pedido pagado.
            </span>
          ) : (
            <span>
              Si el grupo cerrara ahora, tu parte estimada sería{" "}
              <b>
                {money.format(
                  group.estimatedDeliveryFeeCents / 100,
                )}
              </b>{" "}
              en efectivo al momento de la entrega.
            </span>
          )}
        </div>
      )}

      {!group.finalized && !paid && (
        <p className="group-delivery-progress-note">
          Tu pedido se sumará a la meta cuando el pago quede confirmado.
        </p>
      )}

      {group.finalized ? (
        <p className="group-delivery-progress-note">
          El grupo ya cerró. Este monto es definitivo y ya no cambiará.
        </p>
      ) : !group.freeDeliveryUnlocked ? (
        <p className="group-delivery-progress-note">
          Este importe es estimado y puede cambiar hasta que cierre el punto
          de entrega.
        </p>
      ) : null}
    </section>
  );
}
