import type {
  CreateInventoryForm,
  InventoryDraft,
} from "./types";

export function parseInventoryValues(
  values: CreateInventoryForm | InventoryDraft,
) {
  const name = values.name.trim();
  const unit = values.unit.trim();
  const stockQuantity = Number(values.stock);
  const lowStockThreshold = Number(
    values.threshold,
  );

  if (!name || !unit) {
    throw new Error(
      "Nombre y unidad son obligatorios.",
    );
  }

  if (
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0 ||
    !Number.isInteger(
      lowStockThreshold,
    ) ||
    lowStockThreshold < 0
  ) {
    throw new Error(
      "Stock y alerta deben ser números enteros mayores o iguales a 0.",
    );
  }

  return {
    name,
    unit,
    stockQuantity,
    lowStockThreshold,
  };
}
