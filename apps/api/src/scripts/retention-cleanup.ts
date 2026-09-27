import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { RetentionCleanupService } from "../retention/retention-cleanup.service.js";

function parseBatchSize() {
  const value = process.env.RETENTION_BATCH_SIZE;

  if (!value) return 200;

  const parsed = Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > 1000
  ) {
    throw new Error(
      "RETENTION_BATCH_SIZE must be an integer between 1 and 1000",
    );
  }

  return parsed;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const apply = process.argv.includes("--apply");

  if (
    apply &&
    process.env.RETENTION_CLEANUP_ENABLED !== "true"
  ) {
    throw new Error(
      "Refusing to mutate data: set RETENTION_CLEANUP_ENABLED=true",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const cleanup = new RetentionCleanupService(prisma);

  try {
    const report = apply
      ? await cleanup.run({
          batchSize: parseBatchSize(),
        })
      : await cleanup.inspect();

    console.log(JSON.stringify(report, null, 2));

    if (
      "candidates" in report &&
      report.candidates.staleOperationalOrders > 0
    ) {
      console.warn(
        "Retention warning: stale non-final orders require manual review.",
      );
    }

    if (
      "result" in report &&
      report.result.staleOperationalOrders > 0
    ) {
      console.warn(
        "Retention warning: stale non-final orders require manual review.",
      );
    }
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
