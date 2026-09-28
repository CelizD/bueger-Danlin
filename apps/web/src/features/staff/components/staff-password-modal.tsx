import {
  KeyRound,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { ROLE_LABELS } from "../personal/config";
import type {
  PasswordResetForm,
  StaffUser,
} from "../personal/types";

type Props = {
  user: StaffUser;
  form: PasswordResetForm;
  resetting: boolean;
  onChange: (
    field: keyof PasswordResetForm,
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function StaffPasswordModal({
  user,
  form,
  resetting,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <div
      className="staff-modal-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div className="staff-password-modal">
        <div className="staff-form-head">
          <div>
            <p className="admin-kicker">
              Seguridad de cuenta
            </p>
            <h2>
              Cambiar contraseña
            </h2>
            <p>
              {user.name} ·{" "}
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <label>
            <span>
              Nueva contraseña
            </span>
            <input
              required
              type="password"
              minLength={12}
              maxLength={128}
              value={form.password}
              onChange={(event) =>
                onChange(
                  "password",
                  event.target.value,
                )
              }
              autoComplete="new-password"
              placeholder="Mínimo 12 caracteres"
            />
          </label>

          <label>
            <span>
              Confirmar contraseña
            </span>
            <input
              required
              type="password"
              minLength={12}
              maxLength={128}
              value={form.confirm}
              onChange={(event) =>
                onChange(
                  "confirm",
                  event.target.value,
                )
              }
              autoComplete="new-password"
              placeholder="Repite la contraseña"
            />
          </label>

          <p className="staff-password-warning">
            Al guardar, las sesiones
            anteriores de esta cuenta
            dejarán de ser válidas.
          </p>

          <button
            className="staff-primary-button"
            type="submit"
            disabled={resetting}
          >
            <KeyRound size={16} />
            {resetting
              ? "Actualizando…"
              : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
