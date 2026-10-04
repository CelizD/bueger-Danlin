-- Queso es obligatorio (mínimo 1) en el configurador de hamburguesas.
-- Trátalo como consumo base del combo para que productLimits bloquee la venta
-- cuando no hay queso y no intente "resolver" el faltante quitándolo del pedido.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "InventoryUsage" WHERE "key" = 'cheese-included'
  ) AND NOT EXISTS (
    SELECT 1 FROM "InventoryUsage" WHERE "key" = 'cheese-base'
  ) THEN
    UPDATE "InventoryUsage"
    SET
      "key" = 'cheese-base',
      "modifierOptionId" = NULL
    WHERE "key" = 'cheese-included';
  ELSIF EXISTS (
    SELECT 1 FROM "InventoryUsage" WHERE "key" = 'cheese-included'
  ) AND EXISTS (
    SELECT 1 FROM "InventoryUsage" WHERE "key" = 'cheese-base'
  ) THEN
    DELETE FROM "InventoryUsage"
    WHERE "key" = 'cheese-included';
  END IF;
END $$;
