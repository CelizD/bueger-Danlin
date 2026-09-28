import {
  Link2,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import type {
  InventoryDraft,
  InventoryItem,
} from "../inventory/types";

type Props = {
  items: InventoryItem[];
  busyId: string | null;
  getDraft: (
    item: InventoryItem,
  ) => InventoryDraft;
  onDraftChange: (
    item: InventoryItem,
    field: keyof InventoryDraft,
    value: string,
  ) => void;
  onToggle: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onSave: (item: InventoryItem) => void;
};

function cardClass(item: InventoryItem) {
  return (
    "inventory-card " +
    (item.outOfStock
      ? "out"
      : item.lowStock
        ? "low"
        : "") +
    (!item.active
      ? " inactive"
      : "")
  );
}

function statusClass(
  item: InventoryItem,
) {
  return (
    "inventory-status " +
    (!item.active
      ? "disabled"
      : item.outOfStock
        ? "out"
        : item.lowStock
          ? "low"
          : "ok")
  );
}

function statusText(
  item: InventoryItem,
) {
  return !item.active
    ? "Sin control"
    : item.outOfStock
      ? "Agotado"
      : item.lowStock
        ? "Stock bajo"
        : "Disponible";
}

function deleteTitle(
  item: InventoryItem,
) {
  if (item.deletable) {
    return "Eliminar artículo";
  }

  if (item.linkedToSales) {
    return "Está vinculado a ventas; desactívalo si ya no lo usarás.";
  }

  return "Tiene historial y no puede eliminarse.";
}

export function InventoryItemList({
  items,
  busyId,
  getDraft,
  onDraftChange,
  onToggle,
  onDelete,
  onSave,
}: Props) {
  return (
    <section className="inventory-list">
      {items.length === 0 ? (
        <div className="admin-empty">
          No hay artículos. Usa “Nuevo
          artículo” para crear el primero.
        </div>
      ) : (
        items.map((item) => {
          const draft =
            getDraft(item);

          return (
            <article
              className={cardClass(item)}
              key={item.id}
            >
              <div className="inventory-card-head">
                <div>
                  <strong>
                    {item.name}
                  </strong>
                  <span>
                    {item.key}
                    {item.linkedToSales && (
                      <>
                        {" "}
                        ·{" "}
                        <Link2
                          size={11}
                        />{" "}
                        Vinculado a ventas
                      </>
                    )}
                  </span>
                </div>

                <span
                  className={statusClass(
                    item,
                  )}
                >
                  {statusText(item)}
                </span>
              </div>

              <div className="inventory-fields inventory-fields-crud">
                <label>
                  <span>Nombre</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      onDraftChange(
                        item,
                        "name",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>Unidad</span>
                  <input
                    value={draft.unit}
                    onChange={(event) =>
                      onDraftChange(
                        item,
                        "unit",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Disponible ahora
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.stock}
                    onChange={(event) =>
                      onDraftChange(
                        item,
                        "stock",
                        event.target.value,
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Alertar cuando queden
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      draft.threshold
                    }
                    onChange={(event) =>
                      onDraftChange(
                        item,
                        "threshold",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="inventory-actions inventory-actions-crud">
                <button
                  className="inventory-toggle"
                  type="button"
                  onClick={() =>
                    onToggle(item)
                  }
                  disabled={
                    busyId === item.id
                  }
                >
                  {item.active ? (
                    <ToggleLeft
                      size={17}
                    />
                  ) : (
                    <ToggleRight
                      size={17}
                    />
                  )}
                  {item.active
                    ? "Desactivar"
                    : "Activar"}
                </button>

                <button
                  className="inventory-delete"
                  type="button"
                  onClick={() =>
                    onDelete(item)
                  }
                  disabled={
                    busyId === item.id ||
                    !item.deletable
                  }
                  title={deleteTitle(item)}
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>

                <button
                  className="inventory-save"
                  type="button"
                  onClick={() =>
                    onSave(item)
                  }
                  disabled={
                    busyId === item.id
                  }
                >
                  <Save size={16} />
                  {busyId === item.id
                    ? "Guardando…"
                    : "Guardar cambios"}
                </button>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
