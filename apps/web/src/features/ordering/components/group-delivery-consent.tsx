import type { PickupEvent } from "../types";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

type GroupDeliveryConsentProps = {
  event: PickupEvent;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function GroupDeliveryConsent({
  event,
  checked,
  onChange,
}: GroupDeliveryConsentProps) {
  const group = event.groupDelivery;

  let estimateText =
    "Todavía no hay combos pagados para calcular una cantidad por persona.";

  if (group.freeDeliveryUnlocked) {
    estimateText =
      "Actualmente la meta está completa y el envío estimado es $0.";
  } else if (group.estimatedDeliveryFeeCents !== null) {
    estimateText =
      "Actualmente van " +
      group.paidComboCount +
      " de " +
      group.minPaidCombos +
      " combos pagados. Si cerrara ahora, el envío sería aproximadamente " +
      money.format(group.estimatedDeliveryFeeCents / 100) +
      " por pedido.";
  }

  return (
    <section
      className="group-delivery-consent"
      aria-labelledby="group-delivery-consent-title"
    >
      <div className="group-delivery-consent-copy">
        <p className="eyebrow">Entrega grupal</p>
        <h2 id="group-delivery-consent-title">
          Condición del envío
        </h2>
        <p>
          El envío será gratis únicamente si al cierre se alcanza el mínimo
          de <strong>{group.minPaidCombos} combos pagados</strong> para{" "}
          <strong>{event.pickupPoint.name}</strong>.
        </p>
        <p className="group-delivery-estimate">{estimateText}</p>
        <small>
          Los combos de tu pedido cuentan para la meta únicamente después
          de que el pago sea confirmado.
        </small>
      </div>

      <label className="group-delivery-checkbox">
        <input
          type="checkbox"
          checked={checked}
          required
          onChange={(changeEvent) =>
            onChange(changeEvent.target.checked)
          }
        />
        <span>
          Entiendo y acepto que, si no se completa el mínimo de combos
          pagados, tendré que pagar en efectivo mi parte correspondiente
          del envío al momento de la entrega.
        </span>
      </label>
    </section>
  );
}
