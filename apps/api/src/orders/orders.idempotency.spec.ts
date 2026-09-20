import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  createHash,
  createHmac,
} from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";

const SECRET =
  "test-qr-secret-at-least-thirty-two-characters-long";
const originalQrSecret = process.env.QR_TOKEN_SECRET;

const dto: CreateOrderDto = {
  pickupEventId: "event-1",
  customer: {
    name: " Cliente ",
    phone: "+526641234567",
    email: "CLIENTE@EXAMPLE.COM",
  },
  items: [
    {
      productId: "product-1",
      quantity: 1,
      removedModifierOptionIds: ["remove-b", "remove-a"],
      extraModifierOptionIds: ["extra-b", "extra-a"],
    },
  ],
};

function normalizedHash(input: CreateOrderDto) {
  const normalized = {
    pickupEventId: input.pickupEventId,
    customer: {
      name: input.customer.name.trim(),
      phone: input.customer.phone,
      email:
        input.customer.email?.trim().toLowerCase() ?? null,
    },
    items: input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      removedModifierOptionIds: [
        ...(item.removedModifierOptionIds ?? []),
      ].sort(),
      extraModifierOptionIds: [
        ...(item.extraModifierOptionIds ?? []),
      ].sort(),
    })),
  };

  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

function replay(
  requestHash: string,
) {
  return {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    requestKey: "idempotency-key-123456",
    requestHash,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    currency: "MXN",
    subtotalCents: 13000,
    totalCents: 13000,
    comboQuantity: 1,
    reservationExpiresAt: new Date(
      "2026-09-20T17:00:00.000Z",
    ),
    pickupEvent: {
      id: "event-1",
      code: "sat-1",
      locationLabel: "Universidad",
      startsAt: new Date(
        "2026-09-20T18:00:00.000Z",
      ),
      closesAt: new Date(
        "2026-09-20T17:30:00.000Z",
      ),
      timezone: "America/Tijuana",
    },
  };
}

beforeEach(() => {
  process.env.QR_TOKEN_SECRET = SECRET;
});

afterEach(() => {
  if (originalQrSecret === undefined) {
    delete process.env.QR_TOKEN_SECRET;
  } else {
    process.env.QR_TOKEN_SECRET = originalQrSecret;
  }
});

describe("OrdersService idempotency", () => {
  it("rechaza Idempotency-Key demasiado corta antes de escribir", async () => {
    const prisma = {
      order: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const inventory = {} as InventoryService;
    const service = new OrdersService(prisma, inventory);

    await expect(
      service.create(dto, "short"),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reproduce la respuesta sin crear otro pedido si key y payload coinciden", async () => {
    const existing = replay(normalizedHash(dto));
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const inventory = {} as InventoryService;
    const service = new OrdersService(prisma, inventory);

    const result = await service.create(
      dto,
      "idempotency-key-123456",
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      orderCode: "H-A1B2C3D4",
      totalCents: 13000,
      verificationToken: createHmac("sha256", SECRET)
        .update("order-1")
        .digest("base64url"),
    });
  });

  it("rechaza reutilizar la misma key con un payload distinto", async () => {
    const existing = replay("different-request-hash");
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const inventory = {} as InventoryService;
    const service = new OrdersService(prisma, inventory);

    await expect(
      service.create(dto, "idempotency-key-123456"),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("recupera idempotentemente una carrera P2002", async () => {
    const existing = replay(normalizedHash(dto));
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const prisma = {
      order: { findUnique },
      $transaction: vi.fn().mockRejectedValue({
        code: "P2002",
      }),
    } as unknown as PrismaService;
    const inventory = {} as InventoryService;
    const service = new OrdersService(prisma, inventory);

    const result = await service.create(
      dto,
      "idempotency-key-123456",
    );

    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(result.orderCode).toBe("H-A1B2C3D4");
  });
});
