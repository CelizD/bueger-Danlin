import {
  Plus,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import type { CreateInventoryForm } from "../inventory/types";

type Props = {
  form: CreateInventoryForm;
  creating: boolean;
  onChange: (
    field: keyof CreateInventoryForm,
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export function InventoryCreateForm({
  form,
  creating,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <section className="inventory-create-card">
      <div className="inventory-create-head">
        <div>
          <p className="admin-kicker">
            Nuevo registro
          </p>
          <h2>Agregar artículo</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={19} />
        </button>
      </div>

      <form
        className="inventory-create-form"
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
            placeholder="Ej. Pan para hamburguesa"
          />
        </label>

        <label>
          <span>Unidad</span>
          <input
            required
            minLength={1}
            maxLength={40}
            value={form.unit}
            onChange={(event) =>
              onChange(
                "unit",
                event.target.value,
              )
            }
            placeholder="unidad, porción, bolsa…"
          />
        </label>

        <label>
          <span>Stock inicial</span>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={(event) =>
              onChange(
                "stock",
                event.target.value,
              )
            }
          />
        </label>

        <label>
          <span>
            Alerta de stock bajo
          </span>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={form.threshold}
            onChange={(event) =>
              onChange(
                "threshold",
                event.target.value,
              )
            }
          />
        </label>

        <div className="inventory-create-note">
          Los artículos nuevos sirven
          para llevar existencias
          manuales. Para que un artículo
          nuevo bloquee una venta debe
          tener una regla de consumo
          vinculada al producto
          correspondiente.
        </div>

        <div className="inventory-create-actions">
          <button
            type="button"
            className="inventory-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inventory-save"
            disabled={creating}
          >
            <Plus size={16} />
            {creating
              ? "Creando…"
              : "Agregar artículo"}
          </button>
        </div>
      </form>
    </section>
  );
}
