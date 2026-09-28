import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { FormEvent } from "react";
import type { MfaSetup } from "../login/types";

type Props = {
  setup: MfaSetup | null;
  verifyOnly: boolean;
  code: string;
  submitting: boolean;
  error: string;
  onCodeChange: (value: string) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function AdminMfaLogin({
  setup,
  verifyOnly,
  code,
  submitting,
  error,
  onCodeChange,
  onSubmit,
}: Props) {
  const setupMode =
    !verifyOnly && setup != null;

  return (
    <>
      <div className="admin-login-card-head">
        <p className="admin-kicker">
          {setupMode
            ? "Seguridad obligatoria"
            : "Segundo factor"}
        </p>
        <h2>
          {setupMode
            ? "Configura tu MFA"
            : "Verifica tu identidad"}
        </h2>
        <p>
          {setupMode
            ? "Escanea el QR con tu aplicación de autenticación y escribe el código de 6 dígitos."
            : "Escribe el código actual de tu aplicación de autenticación o un código de recuperación."}
        </p>
      </div>

      {error && (
        <div
          className="admin-login-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      {setupMode && (
        <>
          <div className="admin-mfa-qr">
            <QRCodeSVG
              value={setup.otpauthUri}
              size={184}
              level="M"
            />
          </div>

          <div className="admin-mfa-secret">
            <span>Clave manual</span>
            <code>{setup.secret}</code>
          </div>
        </>
      )}

      <form
        className="admin-login-form"
        onSubmit={onSubmit}
      >
        <label>
          <span>
            {setupMode
              ? "Código del autenticador"
              : "Código MFA o recuperación"}
          </span>
          <div className="admin-input-wrap">
            {setupMode ? (
              <Smartphone
                size={18}
                strokeWidth={1.8}
              />
            ) : (
              <KeyRound
                size={18}
                strokeWidth={1.8}
              />
            )}

            <input
              type="text"
              inputMode={
                setupMode
                  ? "numeric"
                  : undefined
              }
              autoComplete="one-time-code"
              pattern={
                setupMode
                  ? "[0-9]{6}"
                  : undefined
              }
              required
              maxLength={
                setupMode ? 6 : 11
              }
              value={code}
              onChange={(event) => {
                const next = setupMode
                  ? event.target.value.replace(
                      /\D/g,
                      "",
                    )
                  : event.target.value
                      .toUpperCase()
                      .replace(
                        /[^A-F0-9-]/g,
                        "",
                      );

                onCodeChange(next);
              }}
              placeholder="000000"
            />
          </div>
        </label>

        <button
          className="admin-login-button"
          type="submit"
          disabled={submitting}
        >
          <span>
            {submitting
              ? "Verificando…"
              : setupMode
                ? "Activar MFA"
                : "Verificar y entrar"}
          </span>
          {setupMode ? (
            <ShieldCheck size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      </form>
    </>
  );
}
