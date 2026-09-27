CREATE TABLE "PickupPoint" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PickupPoint_code_key"
ON "PickupPoint"("code");

CREATE INDEX "PickupPoint_active_name_idx"
ON "PickupPoint"("active", "name");

ALTER TABLE "PickupEvent"
ADD COLUMN "pickupPointId" TEXT,
ADD COLUMN "freeDeliveryMinPaidOrders" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "transportCostCents" INTEGER NOT NULL DEFAULT 0;

INSERT INTO "PickupPoint" (
  "id",
  "code",
  "name",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-' || md5("locationLabel"),
  upper(
    trim(
      BOTH '-'
      FROM regexp_replace(
        regexp_replace(
          translate(
            lower("locationLabel"),
            'áéíóúüñ',
            'aeiouun'
          ),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '-+',
        '-',
        'g'
      )
    )
  ) || '-' || substr(md5("locationLabel"), 1, 6),
  "locationLabel",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PickupEvent"
GROUP BY "locationLabel";

UPDATE "PickupEvent" AS event
SET "pickupPointId" = point."id"
FROM "PickupPoint" AS point
WHERE point."id" = 'legacy-' || md5(event."locationLabel");

ALTER TABLE "PickupEvent"
ALTER COLUMN "pickupPointId" SET NOT NULL;

CREATE INDEX "PickupEvent_pickupPointId_startsAt_idx"
ON "PickupEvent"("pickupPointId", "startsAt");

ALTER TABLE "PickupEvent"
ADD CONSTRAINT "PickupEvent_pickupPointId_fkey"
FOREIGN KEY ("pickupPointId")
REFERENCES "PickupPoint"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
