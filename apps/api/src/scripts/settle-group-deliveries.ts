import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaService } from "../database/prisma.service.js";
import { GroupDeliverySettlementService } from "../group-delivery/group-delivery-settlement.service.js";
import { InventoryService } from "../inventory/inventory.service.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const runtimePrisma = prisma as unknown as PrismaService;
  const inventory = new InventoryService(runtimePrisma);
  const settlement = new GroupDeliverySettlementService(
    runtimePrisma,
    inventory,
  );

  try {
    const report = await settlement.settleExpired();
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
