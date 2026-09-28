CREATE TYPE "PaymentWebhookEventStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "eventId" TEXT NOT NULL,
  "replayKey" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "requestId" TEXT,
  "type" TEXT NOT NULL,
  "bodyHash" TEXT NOT NULL,
  "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key"
ON "PaymentWebhookEvent"("provider", "eventId");

CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_replayKey_key"
ON "PaymentWebhookEvent"("provider", "replayKey");

CREATE INDEX "PaymentWebhookEvent_provider_resourceId_idx"
ON "PaymentWebhookEvent"("provider", "resourceId");

CREATE INDEX "PaymentWebhookEvent_status_receivedAt_idx"
ON "PaymentWebhookEvent"("status", "receivedAt");
