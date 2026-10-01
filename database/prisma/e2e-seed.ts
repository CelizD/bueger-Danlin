import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";
import {
  hashStaffPassword,
  staffPasswordPolicyIssue,
} from "../../apps/api/src/auth/password-security.js";
import { encryptMfaSecret } from "../../apps/api/src/auth/mfa-secret-crypto.js";

const connectionString = process.env.DATABASE_URL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const a11yAdminPassword = process.env.E2E_A11Y_ADMIN_PASSWORD;
const a11yAdminMfaSecret = process.env.E2E_A11Y_ADMIN_MFA_SECRET;
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

if (!adminPassword || adminPassword.length < 12) {
  throw new Error("E2E_ADMIN_PASSWORD must contain at least 12 characters");
}

if (!a11yAdminPassword || a11yAdminPassword.length < 12) {
  throw new Error("E2E_A11Y_ADMIN_PASSWORD must contain at least 12 characters");
}

if (!a11yAdminMfaSecret || a11yAdminMfaSecret.length < 16) {
  throw new Error("E2E_A11Y_ADMIN_MFA_SECRET is required");
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

async function upsertStaff(
  email: string,
  password: string,
  name: string,
  role: "ADMIN" | "KITCHEN" | "DELIVERY",
) {
  const passwordIssue = staffPasswordPolicyIssue(password);

  if (passwordIssue) {
    throw new Error(`Invalid E2E password: ${passwordIssue}`);
  }

  const passwordHash = await hashStaffPassword(password);

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

async function enableStaffMfa(
  email: string,
  secret: string,
) {
  await prisma.user.update({
    where: { email },
    data: {
      mfaEnabled: true,
      mfaSecretEncrypted: encryptMfaSecret(secret),
      mfaRecoveryCodeHashes: [],
      mfaLastUsedStep: null,
      mfaEnrolledAt: new Date(),
    },
  });
}

async function main() {
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.arcoRequest.deleteMany();
  await prisma.pickupEvent.deleteMany();
  await prisma.pickupPoint.deleteMany();

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

  const pickupPoint = await prisma.pickupPoint.create({
    data: {
      code: "UNIVERSIDAD-E2E",
      name: "Universidad",
      address: "Punto de entrega E2E",
      latitude: 32.5149,
      longitude: -117.0382,
      active: true,
    },
  });

  await prisma.pickupEvent.create({
    data: {
      code: "E2E-INTEGRATED",
      name: "Sábado E2E integrado",
      locationLabel: pickupPoint.name,
      pickupPointId: pickupPoint.id,
      timezone: "America/Tijuana",
      closesAt: new Date(now + 2 * 60 * 60 * 1000),
      startsAt: new Date(now + 4 * 60 * 60 * 1000),
      maxCombos: 50,
      freeDeliveryMinPaidCombos: 5,
      transportCostCents: 10000,
      status: "OPEN",
    },
  });

  await upsertStaff(
    "admin.e2e@example.test",
    adminPassword,
    "Admin E2E",
    "ADMIN",
  );

  await upsertStaff(
    "a11y-admin.e2e@example.test",
    a11yAdminPassword,
    "Admin Accesibilidad E2E",
    "ADMIN",
  );

  await enableStaffMfa(
    "a11y-admin.e2e@example.test",
    a11yAdminMfaSecret,
  );

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
