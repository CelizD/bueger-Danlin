ALTER TABLE "Order"
ADD COLUMN "groupDeliveryFeeCollectedAt" TIMESTAMP(3),
ADD COLUMN "groupDeliveryFeeCollectedCents" INTEGER;
