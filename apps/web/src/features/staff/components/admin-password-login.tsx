import {
  ArrowRight,
  LockKeyhole,
  Mail,
} from "lucide-react";
import type { FormEvent } from "react";

type Props = {
  email: string;
  password: string;
  submitting: boolean;
  error: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function AdminPasswordLogin({
  email,
  password,
  submitting,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: Props) {
  return (
    <>
      <div className="admin-login-card-head">
        <p className="admin-kicker">
          Acceso de personal
        </p>
        <h2>Iniciar sesión</h2>
        <p>
          Usa tu cuenta de personal para
          continuar.
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

      <form
        onSubmit={onSubmit}
        className="admin-login-form"
      >
        <label>
          <span>Correo</span>
          <div className="admin-input-wrap">
            <Mail
              size={18}
              strokeWidth={1.8}
            />
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) =>
                onEmailChange(
                  event.target.value,
                )
              }
              placeholder="admin@ejemplo.com"
            />
          </div>
        </label>

        <label>
          <span>Contraseña</span>
          <div className="admin-input-wrap">
            <LockKeyhole
              size={18}
              strokeWidth={1.8}
            />
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) =>
                onPasswordChange(
                  event.target.value,
                )
              }
              placeholder="Tu contraseña"
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
              ? "Validando…"
              : "Entrar al panel"}
          </span>
          <ArrowRight size={18} />
        </button>
      </form>
    </>
  );
}
