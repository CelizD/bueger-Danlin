CREATE TYPE "ArcoRight" AS ENUM (
  'ACCESS',
  'RECTIFICATION',
  'CANCELLATION',
  'OPPOSITION'
);

CREATE TYPE "ArcoRequestStatus" AS ENUM (
  'IDENTITY_VERIFICATION_REQUIRED',
  'IN_REVIEW',
  'RESOLVED',
  'DENIED'
);

CREATE TABLE "ArcoRequest" (
  "id" TEXT NOT NULL,
  "folio" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "rights" "ArcoRight"[] NOT NULL,
  "description" TEXT NOT NULL,
  "locatorInfo" TEXT,
  "rectificationDetails" TEXT,
  "cancellationReason" TEXT,
  "oppositionReason" TEXT,
  "status" "ArcoRequestStatus" NOT NULL DEFAULT 'IDENTITY_VERIFICATION_REQUIRED',
  "identityVerifiedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ArcoRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArcoRequest_folio_key"
ON "ArcoRequest"("folio");

CREATE INDEX "ArcoRequest_status_createdAt_idx"
ON "ArcoRequest"("status", "createdAt");

CREATE INDEX "ArcoRequest_email_createdAt_idx"
ON "ArcoRequest"("email", "createdAt");
