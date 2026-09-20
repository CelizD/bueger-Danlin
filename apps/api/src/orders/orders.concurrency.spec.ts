import { ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { OrdersService } from "./orders.service.js";

type CreatedFixture = {
  eventIds: string[];
  productId: string;
  inventoryItemId?: string;
};

const prisma = new PrismaService();
const inventory = new InventoryService(prisma);
let ordersService: OrdersService;
const fixtures: CreatedFixture[] = [];

async function createEvent(code: string, maxCombos: number) {
  const now = Date.now();

  return prisma.pickupEvent.create({
    data: {
      code,
      name: code,
      locationLabel: "Test",
      timezone: "America/Tijuana",
      startsAt: new Date(now + 2 * 60 * 60 * 1000),
      closesAt: new Date(now + 60 * 60 * 1000),
      maxCombos,
      status: "OPEN",
    },
  });
}

async function cleanupFixture(fixture: CreatedFixture) {
  const existingOrders = await prisma.order.findMany({
    where: {
      pickupEventId: { in: fixture.eventIds },
    },
    select: {
      id: true,
      customerId: true,
    },
  });

  const customerIds = existingOrders.map((order) => order.customerId);

  await prisma.order.deleteMany({
    where: {
      pickupEventId: { in: fixture.eventIds },
    },
  });

  if (customerIds.length > 0) {
    await prisma.customer.deleteMany({
      where: {
        id: { in: customerIds },
      },
    });
  }

  if (fixture.inventoryItemId) {
    await prisma.inventoryUsage.deleteMany({
      where: {
        inventoryItemId: fixture.inventoryItemId,
      },
    });
    await prisma.inventoryItem.delete({
      where: { id: fixture.inventoryItemId },
    });
  }

  await prisma.product.delete({
    where: { id: fixture.productId },
  });

  await prisma.pickupEvent.deleteMany({
    where: {
      id: { in: fixture.eventIds },
    },
  });
}

function orderDto(eventId: string, productId: string, phone: string) {
  return {
    pickupEventId: eventId,
    customer: {
      name: "Cliente prueba",
      phone,
    },
    items: [
      {
        productId,
        quantity: 1,
        removedModifierOptionIds: [],
        extraModifierOptionIds: [],
      },
    ],
  };
}

beforeAll(async () => {
  process.env.QR_TOKEN_SECRET ??=
    "test-qr-secret-at-least-thirty-two-characters-long";
  await prisma.$connect();
  ordersService = new OrdersService(prisma, inventory);
});

afterAll(async () => {
  for (const fixture of fixtures.reverse()) {
    await cleanupFixture(fixture);
  }

  await prisma.$disconnect();
});

describe("OrdersService concurrency", () => {
  it("solo permite un pedido cuando dos clientes compiten por el último combo", async () => {
    const suffix = randomUUID();
    const product = await prisma.product.create({
      data: {
        slug: `test-combo-capacity-${suffix}`,
        name: "Combo concurrencia capacidad",
        type: "COMBO",
        priceCents: 13000,
        active: true,
      },
    });
    const event = await createEvent(`cap-${suffix}`, 1);

    fixtures.push({
      eventIds: [event.id],
      productId: product.id,
    });

    const results = await Promise.allSettled([
      ordersService.create(
        orderDto(event.id, product.id, "+526641234567"),
        randomUUID(),
      ),
      ordersService.create(
        orderDto(event.id, product.id, "+526641234568"),
        randomUUID(),
      ),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result) => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(ConflictException);

    const count = await prisma.order.count({
      where: { pickupEventId: event.id },
    });

    expect(count).toBe(1);
  });

  it("evita sobreventa de inventario entre eventos concurrentes distintos", async () => {
    const suffix = randomUUID();
    const product = await prisma.product.create({
      data: {
        slug: `test-combo-inventory-${suffix}`,
        name: "Combo concurrencia inventario",
        type: "COMBO",
        priceCents: 13000,
        active: true,
      },
    });
    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        key: `test-stock-${suffix}`,
        name: "Stock de prueba",
        unit: "porción",
        stockQuantity: 1,
        lowStockThreshold: 0,
        active: true,
      },
    });

    await prisma.inventoryUsage.create({
      data: {
        key: `test-usage-${suffix}`,
        inventoryItemId: inventoryItem.id,
        productId: product.id,
        quantity: 1,
      },
    });

    const eventA = await createEvent(`inv-a-${suffix}`, 1);
    const eventB = await createEvent(`inv-b-${suffix}`, 1);

    fixtures.push({
      eventIds: [eventA.id, eventB.id],
      productId: product.id,
      inventoryItemId: inventoryItem.id,
    });

    const results = await Promise.allSettled([
      ordersService.create(
        orderDto(eventA.id, product.id, "+526641234569"),
        randomUUID(),
      ),
      ordersService.create(
        orderDto(eventB.id, product.id, "+526641234570"),
        randomUUID(),
      ),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result) => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(ConflictException);

    const stock = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: inventoryItem.id },
      select: { stockQuantity: true },
    });

    expect(stock.stockQuantity).toBe(0);

    const sold = await prisma.order.count({
      where: {
        pickupEventId: {
          in: [eventA.id, eventB.id],
        },
      },
    });

    expect(sold).toBe(1);
  });
});
