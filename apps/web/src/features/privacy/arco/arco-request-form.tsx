"use client";

import { createArcoRequest } from "./api";
import type {
  ArcoRequestResult,
  ArcoRight,
} from "./types";
import {
  type FormEvent,
  useState,
} from "react";

const RIGHTS: Array<{
  value: ArcoRight;
  label: string;
  help: string;
}> = [
  {
    value: "ACCESS",
    label: "Acceso",
    help:
      "Quiero conocer qué datos personales tienen sobre mí y cómo se usan.",
  },
  {
    value: "RECTIFICATION",
    label: "Rectificación",
    help:
      "Quiero corregir o actualizar datos personales inexactos o incompletos.",
  },
  {
    value: "CANCELLATION",
    label: "Cancelación",
    help:
      "Quiero solicitar la supresión o cancelación de datos cuando corresponda.",
  },
  {
    value: "OPPOSITION",
    label: "Oposición",
    help:
      "Quiero oponerme a un tratamiento específico de mis datos.",
  },
];

export function ArcoRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rights, setRights] =
    useState<ArcoRight[]>([]);
  const [description, setDescription] =
    useState("");
  const [locatorInfo, setLocatorInfo] =
    useState("");
  const [
    rectificationDetails,
    setRectificationDetails,
  ] = useState("");
  const [
    cancellationReason,
    setCancellationReason,
  ] = useState("");
  const [
    oppositionReason,
    setOppositionReason,
  ] = useState("");
  const [
    acknowledged,
    setAcknowledged,
  ] = useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");
  const [result, setResult] =
    useState<ArcoRequestResult | null>(
      null,
    );

  function toggleRight(
    right: ArcoRight,
  ) {
    setRights((current) =>
      current.includes(right)
        ? current.filter(
            (item) =>
              item !== right,
          )
        : [...current, right],
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (rights.length === 0) {
      setError(
        "Selecciona al menos un derecho ARCO.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response =
        await createArcoRequest({
          name:
            name.trim(),
          email:
            email
              .trim()
              .toLowerCase(),
          phone:
            phone.trim() ||
            undefined,
          rights,
          description:
            description.trim(),
          locatorInfo:
            locatorInfo.trim() ||
            undefined,
          rectificationDetails:
            rectificationDetails.trim() ||
            undefined,
          cancellationReason:
            cancellationReason.trim() ||
            undefined,
          oppositionReason:
            oppositionReason.trim() ||
            undefined,
          identityVerificationAcknowledged:
            true,
        });

      setResult(response);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo registrar la solicitud ARCO.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section
        className="arco-success"
        aria-live="polite"
      >
        <p className="eyebrow">
          Solicitud recibida
        </p>
        <h2>{result.folio}</h2>
        <p>
          Guarda este folio. Tu
          solicitud quedó registrada
          y la verificación de
          identidad está pendiente.
        </p>
        <p>
          La determinación se
          comunicará dentro del plazo
          legal aplicable. Si el
          derecho procede, se hará
          efectivo dentro del plazo
          correspondiente.
        </p>
      </section>
    );
  }

  return (
    <form
      className="arco-form"
      onSubmit={submit}
    >
      {error && (
        <div
          className="alert"
          role="alert"
        >
          {error}
        </div>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="step">01</p>
            <h2>Datos de contacto</h2>
          </div>
        </div>

        <div className="form-grid">
          <label>
            <span>
              Nombre completo *
            </span>
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Correo electrónico *
            </span>
            <input
              required
              type="email"
              maxLength={160}
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="full-field">
            <span>
              Teléfono (opcional)
            </span>
            <input
              maxLength={24}
              autoComplete="tel"
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
              placeholder="+52 664 123 4567"
            />
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="step">02</p>
            <h2>
              Derecho que deseas
              ejercer
            </h2>
          </div>
        </div>

        <div className="arco-rights">
          {RIGHTS.map((right) => (
            <label
              key={right.value}
              className="arco-right-card"
            >
              <input
                type="checkbox"
                checked={rights.includes(
                  right.value,
                )}
                onChange={() =>
                  toggleRight(
                    right.value,
                  )
                }
              />
              <span>
                <strong>
                  {right.label}
                </strong>
                <small>
                  {right.help}
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="step">03</p>
            <h2>
              Describe tu solicitud
            </h2>
          </div>
        </div>

        <div className="arco-text-fields">
          <label>
            <span>
              ¿Qué necesitas? *
            </span>
            <textarea
              required
              minLength={10}
              maxLength={3000}
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Explica de forma clara qué datos o tratamiento están relacionados con tu solicitud."
            />
          </label>

          <label>
            <span>
              Elementos para localizar
              tus datos (opcional)
            </span>
            <textarea
              maxLength={2000}
              value={locatorInfo}
              onChange={(event) =>
                setLocatorInfo(
                  event.target.value,
                )
              }
              placeholder="Por ejemplo: código de pedido, fecha aproximada de compra o teléfono usado en el pedido."
            />
          </label>

          {rights.includes(
            "RECTIFICATION",
          ) && (
            <label>
              <span>
                Corrección solicitada *
              </span>
              <textarea
                required
                maxLength={2000}
                value={
                  rectificationDetails
                }
                onChange={(event) =>
                  setRectificationDetails(
                    event.target.value,
                  )
                }
                placeholder="Indica qué dato debe cambiar y cuál es el dato correcto."
              />
            </label>
          )}

          {rights.includes(
            "CANCELLATION",
          ) && (
            <label>
              <span>
                Motivo de cancelación *
              </span>
              <textarea
                required
                maxLength={2000}
                value={
                  cancellationReason
                }
                onChange={(event) =>
                  setCancellationReason(
                    event.target.value,
                  )
                }
              />
            </label>
          )}

          {rights.includes(
            "OPPOSITION",
          ) && (
            <label>
              <span>
                Motivo de oposición *
              </span>
              <textarea
                required
                maxLength={2000}
                value={
                  oppositionReason
                }
                onChange={(event) =>
                  setOppositionReason(
                    event.target.value,
                  )
                }
                placeholder="Describe la causa o situación específica que motiva tu oposición."
              />
            </label>
          )}
        </div>
      </section>

      <aside className="privacy-short-notice">
        <strong>
          Verificación de identidad
        </strong>
        <p>
          No subas INE, pasaporte ni
          documentos de identidad en
          este formulario. Después de
          recibir la solicitud,
          Burger Danlin se pondrá en
          contacto contigo para
          acreditar identidad o
          representación antes de
          entregar o modificar datos.
        </p>
      </aside>

      <label className="group-delivery-checkbox">
        <input
          required
          type="checkbox"
          checked={acknowledged}
          onChange={(event) =>
            setAcknowledged(
              event.target.checked,
            )
          }
        />
        <span>
          Entiendo que será necesario
          verificar mi identidad y, en
          su caso, la representación
          legal antes de hacer efectivo
          el derecho solicitado.
        </span>
      </label>

      <button
        className="primary-button"
        type="submit"
        disabled={
          submitting ||
          rights.length === 0 ||
          !acknowledged
        }
      >
        {submitting
          ? "Registrando…"
          : "Enviar solicitud ARCO"}
      </button>
    </form>
  );
}
