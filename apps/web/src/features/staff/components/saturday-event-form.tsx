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

        <label className="saturday-full-field">
          <span>Dirección exacta de entrega</span>
          <input
            required
            maxLength={220}
            value={form.locationAddress}
            onChange={(event) =>
              onChange(
                "locationAddress",
                event.target.value,
              )
            }
            placeholder="Ej. Entrada principal, Av. Universidad 123"
          />
        </label>

        <label>
          <span>Latitud (opcional)</span>
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={form.latitude}
            onChange={(event) =>
              onChange(
                "latitude",
                event.target.value,
              )
            }
            placeholder="32.5149"
          />
        </label>

        <label>
          <span>Longitud (opcional)</span>
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={form.longitude}
            onChange={(event) =>
              onChange(
                "longitude",
                event.target.value,
              )
            }
            placeholder="-117.0382"
          />
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

        <label>
          <span>Meta para envío gratis</span>
          <input
            required
            type="number"
            min="1"
            max="100"
            step="1"
            value={
              form.freeDeliveryMinPaidOrders
            }
            onChange={(event) =>
              onChange(
                "freeDeliveryMinPaidOrders",
                event.target.value,
              )
            }
          />
          <small>
            Solo cuentan pedidos con pago confirmado.
          </small>
        </label>

        <label>
          <span>Costo total de traslado (MXN)</span>
          <input
            required
            type="number"
            min="0"
            max="1000"
            step="0.01"
            value={
              form.transportCostPesos
            }
            onChange={(event) =>
              onChange(
                "transportCostPesos",
                event.target.value,
              )
            }
            placeholder="150.00"
          />
          <small>
            Si no se alcanza la meta, este monto se divide entre los pedidos pagados.
          </small>
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
