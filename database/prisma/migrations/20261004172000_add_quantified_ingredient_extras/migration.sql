-- Expand burger ingredient quantities without changing existing orders.
-- Additional portions of vegetables/sauces are free until business pricing changes.
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
  SELECT 'qty-extra-caramelized-onion-v1', 'extra-caramelized-onion', "id", 'Cebolla caramelizada extra', 'EXTRA'::"ModifierKind", 0, false, true, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'qty-extra-white-onion-v1', 'extra-white-onion', "id", 'Cebolla blanca extra', 'EXTRA'::"ModifierKind", 0, false, true, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'qty-extra-ketchup-v1', 'extra-ketchup', "id", 'Ketchup extra', 'EXTRA'::"ModifierKind", 0, false, true, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
  UNION ALL
  SELECT 'qty-extra-mustard-v1', 'extra-mustard', "id", 'Mostaza extra', 'EXTRA'::"ModifierKind", 0, false, true, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM extras_group
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
