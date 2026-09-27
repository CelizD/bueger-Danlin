import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
const kitchenPassword = process.env.E2E_KITCHEN_PASSWORD;
const deliveryPassword = process.env.E2E_DELIVERY_PASSWORD;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

if (process.env.NODE_ENV !== "test") {
  throw new Error("E2E seed only runs with NODE_ENV=test");
}

const databaseName = new URL(connectionString).pathname.replace(/^\//, "");

if (!databaseName.toLowerCase().includes("test")) {
  throw new Error(
    `Refusing E2E seed because database "${databaseName}" is not a test database`,
  );
}

if (!kitchenPassword || kitchenPassword.length < 12) {
  throw new Error("E2E_KITCHEN_PASSWORD must contain at least 12 characters");
}

if (!deliveryPassword || deliveryPassword.length < 12) {
  throw new Error("E2E_DELIVERY_PASSWORD must contain at least 12 characters");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

async function upsertStaff(
  email: string,
  password: string,
  name: string,
  role: "KITCHEN" | "DELIVERY",
) {
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      active: true,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecretEncrypted: null,
      mfaRecoveryCodeHashes: null,
      mfaLastUsedStep: null,
      mfaEnrolledAt: null,
    },
    create: {
      email,
      name,
      role,
      active: true,
      passwordHash,
    },
  });
}

async function main() {
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.pickupEvent.deleteMany();

  const inventory = await prisma.inventoryItem.findMany({
    select: { id: true },
  });

  if (inventory.length < 5) {
    throw new Error(
      "Base catalog/inventory seed must run before the integrated E2E seed",
    );
  }

  await prisma.inventoryItem.updateMany({
    data: {
      stockQuantity: 100,
      active: true,
    },
  });

  const now = Date.now();

  await prisma.pickupEvent.create({
    data: {
      code: "E2E-INTEGRATED",
      name: "Sábado E2E integrado",
      locationLabel: "Universidad",
      timezone: "America/Tijuana",
      closesAt: new Date(now + 2 * 60 * 60 * 1000),
      startsAt: new Date(now + 4 * 60 * 60 * 1000),
      maxCombos: 50,
      status: "OPEN",
    },
  });

  await upsertStaff(
    "kitchen.e2e@example.test",
    kitchenPassword,
    "Cocina E2E",
    "KITCHEN",
  );

  await upsertStaff(
    "delivery.e2e@example.test",
    deliveryPassword,
    "Entrega E2E",
    "DELIVERY",
  );

  console.log("Integrated E2E dataset ready");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
