import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
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

  await prisma.product.upsert({
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

  await prisma.pickupEvent.upsert({
    where: { code: "SAT-2026-09-26" },
    update: {
      name: "Entrega sábado 26 de septiembre",
      locationLabel: "Universidad",
      timezone: "America/Tijuana",
      startsAt: new Date("2026-09-26T09:30:00-07:00"),
      closesAt: new Date("2026-09-25T21:00:00-07:00"),
      maxCombos: 50,
      status: "OPEN",
    },
    create: {
      code: "SAT-2026-09-26",
      name: "Entrega sábado 26 de septiembre",
      locationLabel: "Universidad",
      timezone: "America/Tijuana",
      startsAt: new Date("2026-09-26T09:30:00-07:00"),
      closesAt: new Date("2026-09-25T21:00:00-07:00"),
      maxCombos: 50,
      status: "OPEN",
    },
  });
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
