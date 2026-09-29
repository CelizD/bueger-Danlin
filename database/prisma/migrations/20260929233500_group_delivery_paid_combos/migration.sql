ALTER TABLE "PickupEvent"
RENAME COLUMN "freeDeliveryMinPaidOrders"
TO "freeDeliveryMinPaidCombos";

ALTER TABLE "PickupEvent"
RENAME COLUMN "groupDeliveryFinalPaidOrders"
TO "groupDeliveryFinalPaidCombos";

ALTER TABLE "PickupEvent"
RENAME COLUMN "telegramGroupCompletedPaidOrders"
TO "telegramGroupCompletedPaidCombos";

ALTER TABLE "Order"
RENAME COLUMN "groupDeliveryMinPaidOrdersAtOrder"
TO "groupDeliveryMinPaidCombosAtOrder";

ALTER TABLE "Order"
RENAME COLUMN "groupDeliveryPaidOrdersAtOrder"
TO "groupDeliveryPaidCombosAtOrder";

-- Finalized event totals can be reconstructed exactly from the paid,
-- non-cancelled orders that belong to the event.
UPDATE "PickupEvent" AS event
SET "groupDeliveryFinalPaidCombos" = COALESCE(
  (
    SELECT SUM(order_row."comboQuantity")
    FROM "Order" AS order_row
    WHERE order_row."pickupEventId" = event."id"
      AND order_row."paymentStatus" = 'PAID'
      AND order_row."status" NOT IN ('CANCELLED', 'REFUNDED')
  ),
  0
)
WHERE event."groupDeliveryFinalizedAt" IS NOT NULL;

UPDATE "PickupEvent" AS event
SET "telegramGroupCompletedPaidCombos" = COALESCE(
  (
    SELECT SUM(order_row."comboQuantity")
    FROM "Order" AS order_row
    WHERE order_row."pickupEventId" = event."id"
      AND order_row."paymentStatus" = 'PAID'
      AND order_row."status" NOT IN ('CANCELLED', 'REFUNDED')
  ),
  0
)
WHERE event."telegramGroupCompletedAt" IS NOT NULL;

-- These snapshots were captured under v1 when the value meant paid orders,
-- so they cannot be truthfully reinterpreted as paid combos.
UPDATE "Order"
SET
  "groupDeliveryMinPaidCombosAtOrder" = NULL,
  "groupDeliveryPaidCombosAtOrder" = NULL
WHERE "groupDeliveryTermsVersion" IS DISTINCT FROM '2026-09-29-v2';
