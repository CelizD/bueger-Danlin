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
