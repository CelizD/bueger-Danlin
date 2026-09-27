ALTER TABLE "PickupEvent"
ADD COLUMN "groupDeliveryFinalCancelledPendingOrders" INTEGER,
ADD COLUMN "telegramGroupCompletedAt" TIMESTAMP(3),
ADD COLUMN "telegramGroupCompletedPaidOrders" INTEGER,
ADD COLUMN "telegramGroupCompletedNotificationClaimedAt" TIMESTAMP(3),
ADD COLUMN "telegramGroupCompletedNotifiedAt" TIMESTAMP(3),
ADD COLUMN "telegramGroupClosedNotificationClaimedAt" TIMESTAMP(3),
ADD COLUMN "telegramGroupClosedNotifiedAt" TIMESTAMP(3);

-- Existing finalized groups predate Telegram group notifications.
-- Mark them as already notified so deployment does not send historical close alerts.
UPDATE "PickupEvent"
SET "telegramGroupClosedNotifiedAt" = "groupDeliveryFinalizedAt"
WHERE "groupDeliveryFinalizedAt" IS NOT NULL;
