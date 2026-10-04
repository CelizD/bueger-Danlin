-- Product catalog images are stored in PostgreSQL for the MVP.
-- Only JPEG, PNG and WebP files accepted by the API are written here.
ALTER TABLE "Product"
  ADD COLUMN "imageData" BYTEA,
  ADD COLUMN "imageMimeType" TEXT;
