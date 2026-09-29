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
