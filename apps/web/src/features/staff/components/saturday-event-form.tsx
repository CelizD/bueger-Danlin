import {
  MapPin,
  Save,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import type { SaturdayFormState } from "../saturdays/types";

type Props = {
  editing: boolean;
  form: SaturdayFormState;
  saving: boolean;
  onChange: (
    field: keyof SaturdayFormState,
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function SaturdayEventForm({
  editing,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <section className="saturday-form-card">
      <div className="saturday-form-head">
        <div>
          <p className="admin-kicker">
            {editing
              ? "Editar configuración"
              : "Nueva entrega"}
          </p>
          <h2>
            {editing
              ? "Modificar sábado"
              : "Programar sábado"}
          </h2>
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
        onSubmit={onSubmit}
        className="saturday-form"
      >
        <label className="saturday-full-field">
          <span>Lugar de entrega</span>
          <div className="saturday-input-icon">
            <MapPin size={17} />
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.locationLabel}
              onChange={(event) =>
                onChange(
                  "locationLabel",
                  event.target.value,
                )
              }
              placeholder="Universidad"
            />
          </div>
        </label>

        <label>
          <span>Fecha de entrega</span>
          <input
            required
            type="date"
            value={form.pickupDate}
            onChange={(event) =>
              onChange(
                "pickupDate",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>Hora de entrega</span>
          <input
            required
            type="time"
            value={form.pickupTime}
            onChange={(event) =>
              onChange(
                "pickupTime",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Fecha límite para ordenar
          </span>
          <input
            required
            type="date"
            value={form.closeDate}
            onChange={(event) =>
              onChange(
                "closeDate",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>Hora límite</span>
          <input
            required
            type="time"
            value={form.closeTime}
            onChange={(event) =>
              onChange(
                "closeTime",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>Límite de combos</span>
          <input
            required
            type="number"
            min="1"
            max="500"
            step="1"
            value={form.maxCombos}
            onChange={(event) =>
              onChange(
                "maxCombos",
                event.target.value,
              )
            }
          />
        </label>

        <div className="saturday-form-note">
          Los horarios se interpretan directamente en
          la zona{" "}
          <strong>America/Tijuana</strong>, aunque
          abras el panel desde otro dispositivo.
        </div>

        <div className="saturday-form-actions">
          <button
            className="saturday-cancel"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="saturday-save"
            type="submit"
            disabled={saving}
          >
            <Save size={17} />
            {saving
              ? "Guardando…"
              : editing
                ? "Guardar cambios"
                : "Crear borrador"}
          </button>
        </div>
      </form>
    </section>
  );
}
