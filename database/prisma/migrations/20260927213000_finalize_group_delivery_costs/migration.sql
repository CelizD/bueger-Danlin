ALTER TABLE "PickupEvent"
ADD COLUMN "groupDeliveryFinalizedAt" TIMESTAMP(3),
ADD COLUMN "groupDeliveryFinalPaidOrders" INTEGER,
ADD COLUMN "groupDeliveryFinalTransportCostCents" INTEGER,
ADD COLUMN "groupDeliveryFinalAssignedCents" INTEGER,
ADD COLUMN "groupDeliveryFinalFreeUnlocked" BOOLEAN;

ALTER TABLE "Order"
ADD COLUMN "groupDeliveryFinalFeeCents" INTEGER,
ADD COLUMN "groupDeliveryFinalizedAt" TIMESTAMP(3);


CREATE INDEX "PickupEvent_groupDeliveryFinalizedAt_closesAt_idx"
ON "PickupEvent"("groupDeliveryFinalizedAt", "closesAt");
