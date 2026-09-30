type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function AgeAuthorizationConsent({
  checked,
  onChange,
}: Props) {
  return (
    <section
      className="purchase-terms-consent"
      aria-labelledby="age-authorization-title"
    >
      <div>
        <p className="eyebrow">
          Menores de edad
        </p>
        <h2 id="age-authorization-title">
          Autorización para realizar el pedido
        </h2>
        <p>
          Si eres menor de 18 años, realiza
          este pedido únicamente con
          autorización de tu madre, padre o
          tutor. Para este flujo no solicitamos
          fecha de nacimiento ni documentos de
          identidad del adulto responsable.
        </p>
      </div>

      <label className="group-delivery-checkbox">
        <input
          type="checkbox"
          checked={checked}
          required
          onChange={(event) =>
            onChange(event.target.checked)
          }
        />
        <span>
          Confirmo que soy mayor de edad o,
          si soy menor de 18 años, que cuento
          con autorización de mi madre, padre
          o tutor para realizar esta compra y
          proporcionar los datos necesarios
          del pedido. Consulta el{" "}
          <a href="/privacidad">
            Aviso de Privacidad
          </a>
          .
        </span>
      </label>
    </section>
  );
}
