ALTER TABLE "User"
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaSecretEncrypted" TEXT,
ADD COLUMN "mfaRecoveryCodeHashes" JSONB,
ADD COLUMN "mfaLastUsedStep" INTEGER,
ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);
