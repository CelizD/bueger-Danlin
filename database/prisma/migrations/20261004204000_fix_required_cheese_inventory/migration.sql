-- Queso ahora es obligatorio (mínimo 1 por combo).
-- Mover su porción incluida al consumo base evita que el frontend lo trate
-- como un ingrediente removible cuando el stock llega a cero.
WITH combo AS (
  SELECT "id"
  FROM "Product"
  WHERE "slug" = 'combo-hamburguesa-papas'
  LIMIT 1
),
cheese AS (
  SELECT "id"
  FROM "InventoryItem"
  WHERE "key" = 'cheese'
  LIMIT 1
)
INSERT INTO "InventoryUsage" (
  "id",
  "key",
  "inventoryItemId",
  "productId",
  "modifierOptionId",
  "quantity"
)
SELECT
  'required-cheese-base-v1',
  'cheese-base',
  cheese."id",
  combo."id",
  NULL,
  1
FROM combo
JOIN cheese ON true
ON CONFLICT ("key") DO UPDATE SET
  "inventoryItemId" = EXCLUDED."inventoryItemId",
  "productId" = EXCLUDED."productId",
  "modifierOptionId" = NULL,
  "quantity" = 1;

DELETE FROM "InventoryUsage"
WHERE "key" = 'cheese-included';
