import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import type { PrismaService } from "../database/prisma.service.js";
import { PurchaseEmailService } from "../notifications/purchase-email.service.js";
import { SmtpMailTransport } from "../notifications/smtp-mail.transport.js";

async function main() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required",
    );
  }

  const prisma =
    new PrismaClient({
      adapter: new PrismaPg({
        connectionString,
      }),
    });

  const runtimePrisma =
    prisma as unknown as PrismaService;
  const mail =
    new SmtpMailTransport();
  const purchaseEmail =
    new PurchaseEmailService(
      runtimePrisma,
      mail,
    );

  try {
    const report =
      await purchaseEmail
        .processPending(25);

    console.log(
      JSON.stringify(
        report,
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );
  process.exit(1);
});
