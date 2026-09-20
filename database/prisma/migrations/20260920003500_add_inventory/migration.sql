CREATE TYPE "InventoryAllocationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryUsage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "modifierOptionId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InventoryUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAllocation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryAllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryItem_key_key" ON "InventoryItem"("key");
CREATE UNIQUE INDEX "InventoryUsage_key_key" ON "InventoryUsage"("key");
CREATE INDEX "InventoryUsage_inventoryItemId_idx" ON "InventoryUsage"("inventoryItemId");
CREATE INDEX "InventoryUsage_productId_idx" ON "InventoryUsage"("productId");
CREATE INDEX "InventoryUsage_modifierOptionId_idx" ON "InventoryUsage"("modifierOptionId");
CREATE UNIQUE INDEX "InventoryAllocation_orderId_inventoryItemId_key" ON "InventoryAllocation"("orderId", "inventoryItemId");
CREATE INDEX "InventoryAllocation_inventoryItemId_status_idx" ON "InventoryAllocation"("inventoryItemId", "status");
CREATE INDEX "InventoryAllocation_status_createdAt_idx" ON "InventoryAllocation"("status", "createdAt");

ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryUsage" ADD CONSTRAINT "InventoryUsage_modifierOptionId_fkey" FOREIGN KEY ("modifierOptionId") REFERENCES "ModifierOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
