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
  deliveryTermsLocked: boolean;
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
  deliveryTermsLocked,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const parsedMaxCombos = Number(
    form.maxCombos,
  );
  const parsedFreeDeliveryTarget =
    Number(
      form.freeDeliveryMinPaidCombos,
    );
  const minimumMaxCombos =
    Number.isInteger(
      parsedFreeDeliveryTarget,
    ) &&
    parsedFreeDeliveryTarget > 0
      ? parsedFreeDeliveryTarget
      : 1;
  const maximumFreeDeliveryTarget =
    Number.isInteger(parsedMaxCombos) &&
    parsedMaxCombos > 0
      ? Math.min(100, parsedMaxCombos)
      : 100;

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
          <span>Dirección del punto (opcional)</span>
          <input
            maxLength={220}
            value={form.locationAddress}
            onChange={(event) =>
              onChange(
                "locationAddress",
                event.target.value,
              )
            }
            placeholder="Av. Universidad 123, Tijuana"
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
            min={minimumMaxCombos}
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
          <span>
            Meta para envío gratis
          </span>
          <input
            required
            type="number"
            min="1"
            max={maximumFreeDeliveryTarget}
            step="1"
            value={
              form.freeDeliveryMinPaidCombos
            }
            disabled={deliveryTermsLocked}
            onChange={(event) =>
              onChange(
                "freeDeliveryMinPaidCombos",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Costo de traslado (MXN)
          </span>
          <input
            required
            type="number"
            min="0"
            max="1000"
            step="0.01"
            value={form.transportCostMx}
            disabled={deliveryTermsLocked}
            onChange={(event) =>
              onChange(
                "transportCostMx",
                event.target.value,
              )
            }
            placeholder="150.00"
          />
        </label>

        {deliveryTermsLocked && (
          <div className="saturday-form-note">
            La meta de envío gratis y el costo de traslado están bloqueados porque esta entrega ya tiene pedidos.
          </div>
        )}

        <div className="saturday-form-note">
          La meta de envío gratis nunca puede ser mayor al límite de combos.
          Si se alcanza la meta de pedidos pagados, el envío queda gratis.
          Si no se alcanza, el costo de traslado se divide entre los pedidos
          pagados y se cobra al entregar. La meta y el costo quedan bloqueados
          desde que existe el primer pedido.
        </div>

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
