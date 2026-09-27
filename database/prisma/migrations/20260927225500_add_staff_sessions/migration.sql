CREATE TABLE "StaffSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialVersion" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffSession_userId_revokedAt_idx"
ON "StaffSession"("userId", "revokedAt");

CREATE INDEX "StaffSession_expiresAt_idx"
ON "StaffSession"("expiresAt");

ALTER TABLE "StaffSession"
ADD CONSTRAINT "StaffSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
