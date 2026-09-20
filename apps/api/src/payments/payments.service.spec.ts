import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import { PaymentsService } from "./payments.service.js";

const TOKEN = "order-token-valid-for-payment-tests";
const TOKEN_HASH = createHash("sha256")
  .update(TOKEN)
  .digest("hex");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    verificationTokenHash: TOKEN_HASH,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    reservationExpiresAt: new Date(Date.now() + 15 * 60_000),
    totalCents: 13000,
    currency: "MXN",
    pickupEvent: { id: "event-1" },
    ...overrides,
  };
}

function harness(
  snapshot: ReturnType<typeof order> | null,
  lockedOrder: ReturnType<typeof order> | null = snapshot,
) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(
      lockedOrder ? [{ id: lockedOrder.id }] : [],
    ),
    order: {
      findUnique: vi.fn().mockResolvedValue(lockedOrder),
      update: vi.fn().mockResolvedValue(undefined),
    },
    payment: {
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };

  const prisma = {
    order: {
      findUnique: vi.fn().mockResolvedValue(snapshot),
    },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    ),
  } as unknown as PrismaService;

  const inventory = {
    commitOrder: vi.fn().mockResolvedValue(undefined),
  } as unknown as InventoryService;

  return {
    service: new PaymentsService(prisma, inventory),
    prisma,
    inventory,
    tx,
  };
}

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe("PaymentsService", () => {
  it("oculta el endpoint mock en producción antes de tocar la base", async () => {
    process.env.NODE_ENV = "production";
    const { service, prisma } = harness(order());

    await expect(
      service.confirmMockPayment("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("rechaza un token de pedido inválido", async () => {
    process.env.NODE_ENV = "test";
    const { service } = harness(order());

    await expect(
      service.confirmMockPayment(
        "H-A1B2C3D4",
        "token-equivocado",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("es idempotente cuando el pedido ya está pagado", async () => {
    process.env.NODE_ENV = "test";
    const paidOrder = order({
      status: "PAID",
      paymentStatus: "PAID",
      reservationExpiresAt: null,
    });
    const { service, tx, inventory } = harness(
      paidOrder,
      paidOrder,
    );

    const result = await service.confirmMockPayment(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(result).toMatchObject({
      orderCode: "H-A1B2C3D4",
      status: "PAID",
      paymentStatus: "PAID",
      paid: true,
    });
    expect(tx.payment.upsert).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(inventory.commitOrder).not.toHaveBeenCalled();
  });

  it("rechaza el pago cuando la reserva ya expiró", async () => {
    process.env.NODE_ENV = "test";
    const expired = order({
      reservationExpiresAt: new Date(Date.now() - 1_000),
    });
    const { service, tx, inventory } = harness(
      expired,
      expired,
    );

    await expect(
      service.confirmMockPayment("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.payment.upsert).not.toHaveBeenCalled();
    expect(inventory.commitOrder).not.toHaveBeenCalled();
  });

  it("confirma una sola vez el pago, la orden y el inventario", async () => {
    process.env.NODE_ENV = "test";
    const pending = order();
    const { service, tx, inventory } = harness(
      pending,
      pending,
    );

    const result = await service.confirmMockPayment(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(tx.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "mock:order-1" },
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "PAID",
          paymentStatus: "PAID",
          reservationExpiresAt: null,
        }),
      }),
    );
    expect(inventory.commitOrder).toHaveBeenCalledWith(
      tx,
      "order-1",
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "PAID",
      paymentStatus: "PAID",
      totalCents: 13000,
      currency: "MXN",
      paid: true,
    });
  });
});
