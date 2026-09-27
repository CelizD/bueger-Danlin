ALTER TABLE "Order"
ADD COLUMN "groupDeliveryTermsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "groupDeliveryTermsVersion" TEXT,
ADD COLUMN "groupDeliveryMinPaidOrdersAtOrder" INTEGER,
ADD COLUMN "groupDeliveryTransportCostCentsAtOrder" INTEGER,
ADD COLUMN "groupDeliveryPaidOrdersAtOrder" INTEGER,
ADD COLUMN "groupDeliveryEstimatedFeeCentsAtOrder" INTEGER;
