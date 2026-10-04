import "dotenv/config";
import { readSetting } from "../config/secret-setting.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaService } from "../database/prisma.service.js";
import { GroupDeliverySettlementService } from "../group-delivery/group-delivery-settlement.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";

async function main() {
  const connectionString = readSetting("DATABASE_URL");

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const runtimePrisma = prisma as unknown as PrismaService;
  const inventory = new InventoryService(runtimePrisma);
  const telegram = new TelegramNotificationService();
  const groupTelegram = new GroupTelegramNotificationService(
    runtimePrisma,
    telegram,
  );
  const settlement = new GroupDeliverySettlementService(
    runtimePrisma,
    inventory,
    groupTelegram,
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
