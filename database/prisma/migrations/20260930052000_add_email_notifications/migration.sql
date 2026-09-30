CREATE TYPE "EmailNotificationType" AS ENUM ('PURCHASE_CONFIRMATION');
CREATE TYPE "EmailNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "EmailNotification" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "EmailNotificationType" NOT NULL,
  "recipient" TEXT NOT NULL,
  "status" "EmailNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailNotification_orderId_type_key"
ON "EmailNotification"("orderId", "type");

CREATE INDEX "EmailNotification_status_createdAt_idx"
ON "EmailNotification"("status", "createdAt");

CREATE INDEX "EmailNotification_claimedAt_idx"
ON "EmailNotification"("claimedAt");

ALTER TABLE "EmailNotification"
ADD CONSTRAINT "EmailNotification_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
