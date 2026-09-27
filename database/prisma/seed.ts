import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";
import {
  hashStaffPassword,
  staffPasswordPolicyIssue,
} from "../../apps/api/src/auth/password-security.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  const adminName = process.env.ADMIN_SEED_NAME?.trim() || "Administrador";

  if (adminEmail && adminPassword) {
    const passwordIssue = staffPasswordPolicyIssue(adminPassword);

    if (passwordIssue) {
      throw new Error(`ADMIN_SEED_PASSWORD: ${passwordIssue}`);
    }

    const passwordHash = await hashStaffPassword(adminPassword);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        role: "ADMIN",
        active: true,
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        email: adminEmail,
        name: adminName,
        role: "ADMIN",
        active: true,
        passwordHash,
      },
    });

    console.log(`Admin local actualizado: ${adminEmail}`);
  } else {
    console.log("Admin seed omitido: define ADMIN_SEED_EMAIL y ADMIN_SEED_PASSWORD en .env");
  }

  const combo = await prisma.product.upsert({
    where: { slug: "combo-hamburguesa-papas" },
    update: {
      name: "Combo Hamburguesa + Papas",
      description: "Hamburguesa personalizable acompañada de papas.",
      type: "COMBO",
      priceCents: 13000,
      active: true,
    },
    create: {
      slug: "combo-hamburguesa-papas",
      name: "Combo Hamburguesa + Papas",
      description: "Hamburguesa personalizable acompañada de papas.",
      type: "COMBO",
      priceCents: 13000,
      active: true,
    },
  });

  const coke = await prisma.product.upsert({
    where: { slug: "coca-cola-lata" },
    update: {
      name: "Coca-Cola lata",
      description: "Coca-Cola en lata.",
      type: "BEVERAGE",
      priceCents: 3000,
      active: true,
      trackStock: false,
      stockQuantity: null,
    },
    create: {
      slug: "coca-cola-lata",
      name: "Coca-Cola lata",
      description: "Coca-Cola en lata.",
      type: "BEVERAGE",
      priceCents: 3000,
      active: true,
      trackStock: false,
    },
  });

  const included = await prisma.modifierGroup.upsert({
    where: { key: "included-ingredients" },
    update: {
      name: "Ingredientes incluidos",
      description: "Quita los ingredientes que no quieras.",
      minSelect: 0,
      active: true,
    },
    create: {
      key: "included-ingredients",
      name: "Ingredientes incluidos",
      description: "Quita los ingredientes que no quieras.",
      minSelect: 0,
      active: true,
    },
  });

  const includedNames = [
    ["lettuce", "Lechuga"],
    ["tomato", "Tomate"],
    ["caramelized-onion", "Cebolla caramelizada"],
    ["white-onion", "Cebolla blanca"],
    ["cheese", "Queso"],
    ["bacon", "Tocino"],
    ["ketchup", "Ketchup"],
    ["mustard", "Mostaza"],
  ] as const;

  for (const [key, name] of includedNames) {
    const index = includedNames.findIndex(([optionKey]) => optionKey === key);
    await prisma.modifierOption.upsert({
      where: { key: `included-${key}` },
      update: {
        groupId: included.id,
        name,
        kind: "REMOVABLE",
        priceDeltaCents: 0,
        defaultSelected: true,
        active: true,
        sortOrder: index,
      },
      create: {
        key: `included-${key}`,
        groupId: included.id,
        name,
        kind: "REMOVABLE",
        priceDeltaCents: 0,
        defaultSelected: true,
        active: true,
        sortOrder: index,
      },
    });
  }

  const extras = await prisma.modifierGroup.upsert({
    where: { key: "burger-extras" },
    update: {
      name: "Extras",
      description: "Agrega extras a tu hamburguesa.",
      minSelect: 0,
      active: true,
    },
    create: {
      key: "burger-extras",
      name: "Extras",
      description: "Agrega extras a tu hamburguesa.",
      minSelect: 0,
      active: true,
    },
  });

  const extraOptions = [
    { key: "extra-meat", name: "Carne extra", priceDeltaCents: 3000 },
    { key: "extra-cheese", name: "Queso extra", priceDeltaCents: 1000 },
    { key: "extra-bacon", name: "Tocino extra", priceDeltaCents: 1500 },
    { key: "extra-fries", name: "Papas extra", priceDeltaCents: 2500 },
  ] as const;

  for (const [index, option] of extraOptions.entries()) {
    await prisma.modifierOption.upsert({
      where: { key: option.key },
      update: {
        groupId: extras.id,
        name: option.name,
        kind: "EXTRA",
        priceDeltaCents: option.priceDeltaCents,
        defaultSelected: false,
        active: true,
        sortOrder: index,
      },
      create: {
        key: option.key,
        groupId: extras.id,
        name: option.name,
        kind: "EXTRA",
        priceDeltaCents: option.priceDeltaCents,
        defaultSelected: false,
        active: true,
        sortOrder: index,
      },
    });
  }

  await prisma.productModifierGroup.upsert({
    where: {
      productId_modifierGroupId: {
        productId: combo.id,
        modifierGroupId: included.id,
      },
    },
    update: { sortOrder: 0 },
    create: {
      productId: combo.id,
      modifierGroupId: included.id,
      sortOrder: 0,
    },
  });

  await prisma.productModifierGroup.upsert({
    where: {
      productId_modifierGroupId: {
        productId: combo.id,
        modifierGroupId: extras.id,
      },
    },
    update: { sortOrder: 1 },
    create: {
      productId: combo.id,
      modifierGroupId: extras.id,
      sortOrder: 1,
    },
  });

  const inventoryDefinitions = [
    { key: "coca-cola", name: "Coca-Cola", unit: "lata", lowStockThreshold: 10 },
    { key: "meat", name: "Carne", unit: "porción", lowStockThreshold: 10 },
    { key: "cheese", name: "Queso", unit: "porción", lowStockThreshold: 10 },
    { key: "bacon", name: "Tocino", unit: "porción", lowStockThreshold: 10 },
    { key: "fries", name: "Papas", unit: "porción", lowStockThreshold: 10 },
  ] as const;

  const inventoryByKey = new Map<string, { id: string }>();

  for (const item of inventoryDefinitions) {
    const inventoryItem = await prisma.inventoryItem.upsert({
      where: { key: item.key },
      update: {
        name: item.name,
        unit: item.unit,
        active: true,
      },
      create: {
        key: item.key,
        name: item.name,
        unit: item.unit,
        stockQuantity: 0,
        lowStockThreshold: item.lowStockThreshold,
        active: true,
      },
      select: { id: true },
    });

    inventoryByKey.set(item.key, inventoryItem);
  }

  const optionKeys = [
    "included-cheese",
    "included-bacon",
    "extra-meat",
    "extra-cheese",
    "extra-bacon",
    "extra-fries",
  ];

  const inventoryOptions = await prisma.modifierOption.findMany({
    where: { key: { in: optionKeys } },
    select: { id: true, key: true },
  });

  const optionByKey = new Map(
    inventoryOptions.map((option) => [option.key, option.id]),
  );

  const usageDefinitions = [
    {
      key: "coke-product",
      inventoryKey: "coca-cola",
      productId: coke.id,
      modifierKey: null,
    },
    {
      key: "meat-base",
      inventoryKey: "meat",
      productId: combo.id,
      modifierKey: null,
    },
    {
      key: "fries-base",
      inventoryKey: "fries",
      productId: combo.id,
      modifierKey: null,
    },
    {
      key: "cheese-included",
      inventoryKey: "cheese",
      productId: combo.id,
      modifierKey: "included-cheese",
    },
    {
      key: "bacon-included",
      inventoryKey: "bacon",
      productId: combo.id,
      modifierKey: "included-bacon",
    },
    {
      key: "meat-extra",
      inventoryKey: "meat",
      productId: combo.id,
      modifierKey: "extra-meat",
    },
    {
      key: "cheese-extra",
      inventoryKey: "cheese",
      productId: combo.id,
      modifierKey: "extra-cheese",
    },
    {
      key: "bacon-extra",
      inventoryKey: "bacon",
      productId: combo.id,
      modifierKey: "extra-bacon",
    },
    {
      key: "fries-extra",
      inventoryKey: "fries",
      productId: combo.id,
      modifierKey: "extra-fries",
    },
  ] as const;

  for (const usage of usageDefinitions) {
    const inventoryItemId = inventoryByKey.get(usage.inventoryKey)?.id;
    const modifierOptionId = usage.modifierKey
      ? optionByKey.get(usage.modifierKey)
      : null;

    if (!inventoryItemId || (usage.modifierKey && !modifierOptionId)) {
      throw new Error(`No se pudo configurar inventario: ${usage.key}`);
    }

    await prisma.inventoryUsage.upsert({
      where: { key: usage.key },
      update: {
        inventoryItemId,
        productId: usage.productId,
        modifierOptionId,
        quantity: 1,
      },
      create: {
        key: usage.key,
        inventoryItemId,
        productId: usage.productId,
        modifierOptionId,
        quantity: 1,
      },
    });
  }
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
