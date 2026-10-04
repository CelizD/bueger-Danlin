-- Expand burger ingredient quantities without changing existing orders.
-- Zero-price options preserve the current catalog price: no new charge is introduced.
WITH extras_group AS (
  SELECT "id"
  FROM "ModifierGroup"
  WHERE "key" = 'burger-extras'
  LIMIT 1
)
INSERT INTO "ModifierOption" (
  "id",
  "key",
  "groupId",
  "name",
  "kind",
  "priceDeltaCents",
  "defaultSelected",
  "active",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT *
FROM (
  SELECT 'qty-extra-lettuce-v1', 'extra-lettuce', "id", 'Lechuga extra', 'EXTRA'::"ModifierKind", 0, false, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'qty-extra-tomato-v1', 'extra-tomato', "id", 'Tomate extra', 'EXTRA'::"ModifierKind", 0, false, true, 11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'qty-extra-white-onion-v1', 'extra-white-onion', "id", 'Cebolla extra', 'EXTRA'::"ModifierKind", 0, false, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'qty-extra-pickles-v1', 'extra-pickles', "id", 'Pepinillos', 'EXTRA'::"ModifierKind", 0, false, true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'sauce-mayonnaise-v1', 'extra-mayonnaise', "id", 'Mayonesa', 'EXTRA'::"ModifierKind", 0, false, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'sauce-chipotle-v1', 'extra-chipotle', "id", 'Chipotle', 'EXTRA'::"ModifierKind", 0, false, true, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'sauce-bbq-chipotle-v1', 'extra-bbq-chipotle', "id", 'BBQ con Chipotle', 'EXTRA'::"ModifierKind", 0, false, true, 22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
) AS incoming(
  "id",
  "key",
  "groupId",
  "name",
  "kind",
  "priceDeltaCents",
  "defaultSelected",
  "active",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
ON CONFLICT ("key") DO UPDATE SET
  "groupId" = EXCLUDED."groupId",
  "name" = EXCLUDED."name",
  "kind" = EXCLUDED."kind",
  "priceDeltaCents" = EXCLUDED."priceDeltaCents",
  "defaultSelected" = EXCLUDED."defaultSelected",
  "active" = EXCLUDED."active",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;


-- Track the requested vegetable/pickle portions in the same inventory system.
-- New inventory rows start at 0 so production never assumes stock that was not counted.
INSERT INTO "InventoryItem" (
  "id",
  "key",
  "name",
  "unit",
  "stockQuantity",
  "lowStockThreshold",
  "active",
  "createdAt",
  "updatedAt"
)
VALUES
  ('qty-inventory-lettuce-v1', 'lettuce', 'Lechuga', 'porción', 0, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qty-inventory-tomato-v1', 'tomato', 'Tomate', 'porción', 0, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qty-inventory-onion-v1', 'onion', 'Cebolla', 'porción', 0, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('qty-inventory-pickles-v1', 'pickles', 'Pepinillos', 'porción', 0, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "unit" = EXCLUDED."unit",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

WITH combo AS (
  SELECT "id"
  FROM "Product"
  WHERE "slug" = 'combo-hamburguesa-papas'
  LIMIT 1
),
usage_source("id", "key", "inventoryKey", "modifierKey") AS (
  VALUES
    ('qty-usage-lettuce-included-v1', 'lettuce-included', 'lettuce', 'included-lettuce'),
    ('qty-usage-lettuce-extra-v1', 'lettuce-extra', 'lettuce', 'extra-lettuce'),
    ('qty-usage-tomato-included-v1', 'tomato-included', 'tomato', 'included-tomato'),
    ('qty-usage-tomato-extra-v1', 'tomato-extra', 'tomato', 'extra-tomato'),
    ('qty-usage-onion-included-v1', 'onion-included', 'onion', 'included-white-onion'),
    ('qty-usage-onion-extra-v1', 'onion-extra', 'onion', 'extra-white-onion'),
    ('qty-usage-pickles-extra-v1', 'pickles-extra', 'pickles', 'extra-pickles')
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
  source."id",
  source."key",
  inventory."id",
  combo."id",
  modifier."id",
  1
FROM usage_source source
JOIN "InventoryItem" inventory
  ON inventory."key" = source."inventoryKey"
JOIN combo
  ON true
JOIN "ModifierOption" modifier
  ON modifier."key" = source."modifierKey"
ON CONFLICT ("key") DO UPDATE SET
  "inventoryItemId" = EXCLUDED."inventoryItemId",
  "productId" = EXCLUDED."productId",
  "modifierOptionId" = EXCLUDED."modifierOptionId",
  "quantity" = EXCLUDED."quantity";
