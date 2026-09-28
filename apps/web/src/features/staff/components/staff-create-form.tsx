import {
  Mail,
  Plus,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import type {
  CreateStaffForm,
  StaffRole,
} from "../personal/types";

type Props = {
  form: CreateStaffForm;
  creating: boolean;
  onChange: (
    field: keyof CreateStaffForm,
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function StaffCreateForm({
  form,
  creating,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <section className="staff-form-card">
      <div className="staff-form-head">
        <div>
          <p className="admin-kicker">
            Nuevo acceso
          </p>
          <h2>Crear cuenta</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar formulario"
        >
          <X size={19} />
        </button>
      </div>

      <form
        className="staff-create-form"
        onSubmit={onSubmit}
      >
        <label>
          <span>Nombre</span>
          <input
            required
            minLength={2}
            maxLength={100}
            value={form.name}
            onChange={(event) =>
              onChange(
                "name",
                event.target.value,
              )
            }
            placeholder="Nombre del empleado"
          />
        </label>

        <label>
          <span>Correo</span>
          <div className="staff-input-icon">
            <Mail size={16} />
            <input
              required
              type="email"
              maxLength={160}
              value={form.email}
              onChange={(event) =>
                onChange(
                  "email",
                  event.target.value,
                )
              }
              placeholder="cocina@ejemplo.com"
            />
          </div>
        </label>

        <label>
          <span>Rol</span>
          <select
            value={form.role}
            onChange={(event) =>
              onChange(
                "role",
                event.target.value as StaffRole,
              )
            }
          >
            <option value="KITCHEN">
              Cocina
            </option>
            <option value="DELIVERY">
              Entrega
            </option>
            <option value="ADMIN">
              Administrador
            </option>
          </select>
        </label>

        <label>
          <span>
            Contraseña temporal
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
            placeholder="Mínimo 12 caracteres"
            autoComplete="new-password"
          />
        </label>

        <div className="staff-form-note">
          La contraseña se guarda con{" "}
          <strong>Argon2id</strong>. Cada
          persona debe tener su propia
          cuenta; no compartas un acceso
          entre Cocina y Entrega.
        </div>

        <div className="staff-form-actions">
          <button
            type="button"
            className="staff-secondary-button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="staff-primary-button"
            disabled={creating}
          >
            <Plus size={16} />
            {creating
              ? "Creando…"
              : "Crear cuenta"}
          </button>
        </div>
      </form>
    </section>
  );
}
