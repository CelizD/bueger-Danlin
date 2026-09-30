type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function PurchaseTermsConsent({
  checked,
  onChange,
}: Props) {
  return (
    <section
      className="purchase-terms-consent"
      aria-labelledby="purchase-terms-title"
    >
      <div>
        <p className="eyebrow">
          Compra
        </p>
        <h2 id="purchase-terms-title">
          Términos de compra
        </h2>
        <p>
          Revisa las reglas de pago,
          cancelación, entrega y reembolso
          antes de continuar.
        </p>
      </div>

      <label className="group-delivery-checkbox">
        <input
          type="checkbox"
          checked={checked}
          required
          onChange={(event) =>
            onChange(
              event.target.checked,
            )
          }
        />
        <span>
          He leído y acepto los{" "}
          <a href="/terminos">
            Términos y Condiciones
          </a>
          , incluida la política de
          cancelación y reembolso.
        </span>
      </label>
    </section>
  );
}
