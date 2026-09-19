import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../apps/api/src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const combo = await prisma.product.create({
    data: {
      name: "Combo Hamburguesa + Papas",
      description: "Hamburguesa personalizable acompañada de papas.",
      type: "COMBO",
      priceCents: 13000,
      active: true,
    },
  });

  await prisma.product.create({
    data: {
      name: "Coca-Cola lata",
      description: "Coca-Cola en lata.",
      type: "BEVERAGE",
      priceCents: 3000,
      active: true,
      trackStock: true,
      stockQuantity: 0,
    },
  });

  const included = await prisma.modifierGroup.create({
    data: {
      name: "Ingredientes incluidos",
      description: "Quita los ingredientes que no quieras.",
      minSelect: 0,
      options: {
        create: [
          "Lechuga",
          "Tomate",
          "Cebolla caramelizada",
          "Cebolla blanca",
          "Queso",
          "Tocino",
          "Ketchup",
          "Mostaza",
        ].map((name, index) => ({
          name,
          kind: "REMOVABLE",
          priceDeltaCents: 0,
          defaultSelected: true,
          sortOrder: index,
        })),
      },
    },
  });

  const extras = await prisma.modifierGroup.create({
    data: {
      name: "Extras",
      description: "Agrega extras a tu hamburguesa.",
      minSelect: 0,
      options: {
        create: [
          { name: "Carne extra", priceDeltaCents: 3000 },
          { name: "Queso extra", priceDeltaCents: 1000 },
          { name: "Tocino extra", priceDeltaCents: 1500 },
          { name: "Papas extra", priceDeltaCents: 2500 },
        ].map((item, index) => ({
          ...item,
          kind: "EXTRA" as const,
          defaultSelected: false,
          sortOrder: index,
        })),
      },
    },
  });

  await prisma.productModifierGroup.createMany({
    data: [
      { productId: combo.id, modifierGroupId: included.id, sortOrder: 0 },
      { productId: combo.id, modifierGroupId: extras.id, sortOrder: 1 },
    ],
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
