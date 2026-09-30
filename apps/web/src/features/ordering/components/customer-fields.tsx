import type { PublicPrivacyConfig } from "@/features/privacy/types";

type CustomerFieldsProps = {
  privacy: PublicPrivacyConfig;
  name: string;
  phone: string;
  email: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
};

export function CustomerFields({
  privacy,
  name,
  phone,
  email,
  onNameChange,
  onPhoneChange,
  onEmailChange,
}: CustomerFieldsProps) {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="step">03</p>
          <h2>Tus datos</h2>
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>Nombre *</span>
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            autoComplete="name"
            onChange={(event) =>
              onNameChange(
                event.target.value,
              )
            }
            placeholder="Tu nombre"
          />
        </label>

        <label>
          <span>Teléfono *</span>
          <div className="phone-input">
            <b>+52</b>
            <input
              required
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(event) =>
                onPhoneChange(
                  event.target.value.replace(
                    /\D/g,
                    "",
                  ),
                )
              }
              placeholder="6641234567"
            />
          </div>
        </label>

        <label className="full-field">
          <span>Correo (opcional)</span>
          <input
            type="email"
            autoComplete="email"
            maxLength={160}
            value={email}
            onChange={(event) =>
              onEmailChange(
                event.target.value,
              )
            }
            placeholder="correo@ejemplo.com"
          />
        </label>
      </div>

      <aside
        className="privacy-short-notice"
        aria-label="Aviso de privacidad simplificado"
      >
        <strong>
          Aviso de privacidad simplificado
        </strong>
        <p>
          <b>{privacy.responsible}</b>,
          con domicilio en{" "}
          <b>{privacy.address}</b>, es
          responsable de tus datos.
          Trataremos tu nombre, teléfono,
          correo opcional y datos del pedido
          para crear y administrar tu compra,
          procesar pagos o reembolsos,
          coordinar la entrega, darte soporte
          y proteger el servicio.
        </p>
        <p>
          No usamos estos datos para marketing
          directo en el flujo actual. Puedes
          limitar su uso o divulgación y ejercer
          tus derechos ARCO desde el{" "}
          <a href="/arco">
            formulario público ARCO
          </a>
          {" "}o escribiendo a{" "}
          <a
            href={
              "mailto:" + privacy.email
            }
          >
            {privacy.email}
          </a>
          . Consulta el{" "}
          <a href="/privacidad">
            Aviso de Privacidad integral
          </a>
          .
        </p>
      </aside>
    </section>
  );
}
