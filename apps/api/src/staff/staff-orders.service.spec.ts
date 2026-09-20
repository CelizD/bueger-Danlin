import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { StaffOrdersService } from "./staff-orders.service.js";

const TOKEN = "a".repeat(40);
const TOKEN_HASH = createHash("sha256")
  .update(TOKEN)
  .digest("hex");
const QR = `BD1:H-A1B2C3D4:${TOKEN}`;

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    status: "READY",
    paymentStatus: "PAID",
    currency: "MXN",
    totalCents: 13000,
    comboQuantity: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveredAt: null,
    customer: {
      name: "Cliente",
      phone: "+526641234567",
      email: null,
    },
    pickupEvent: {
      code: "sat-test",
      name: "Sábado",
      locationLabel: "Universidad",
      startsAt: new Date(),
      timezone: "America/Tijuana",
    },
    items: [],
    verificationTokenHash: TOKEN_HASH,
    ...overrides,
  };
}

function harness(currentOrder: ReturnType<typeof order>) {
  const updatedOrder = {
    ...currentOrder,
    status: "DELIVERED",
    deliveredAt: new Date(),
  };

  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ id: currentOrder.id }]),
    order: {
      findUnique: vi.fn().mockResolvedValue(currentOrder),
      update: vi.fn().mockResolvedValue(updatedOrder),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    ),
  } as unknown as PrismaService;

  return {
    service: new StaffOrdersService(prisma),
    tx,
  };
}

describe("StaffOrdersService.deliverFromQr", () => {
  it("rechaza QRs que no sean de Burger Danlin", async () => {
    const { service } = harness(order());

    await expect(
      service.deliverFromQr("https://example.com/qr", "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un token QR que no pertenece al pedido", async () => {
    const current = order();
    const { service, tx } = harness(current);
    const badQr = `BD1:H-A1B2C3D4:${"b".repeat(40)}`;

    await expect(
      service.deliverFromQr(badQr, "user-1"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("rechaza entregar un pedido que todavía no está pagado", async () => {
    const current = order({
      paymentStatus: "PENDING",
    });
    const { service, tx } = harness(current);

    await expect(
      service.deliverFromQr(QR, "user-1"),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it("entrega un pedido READY y registra historial y auditoría", async () => {
    const current = order();
    const { service, tx } = harness(current);

    const result = await service.deliverFromQr(
      QR,
      "delivery-user",
    );

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: {
          status: "DELIVERED",
          deliveredAt: expect.any(Date),
        },
      }),
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId: "order-1",
        from: "READY",
        to: "DELIVERED",
        note: "Pedido entregado mediante QR validado.",
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "delivery-user",
        action: "ORDER_QR_DELIVERED",
        entityType: "Order",
        entityId: "order-1",
        before: { status: "READY" },
        after: { status: "DELIVERED", method: "QR" },
      },
    });
    expect(result).toMatchObject({
      status: "DELIVERED",
      alreadyDelivered: false,
    });
    expect(result).not.toHaveProperty(
      "verificationTokenHash",
    );
  });

  it("es idempotente si el pedido ya fue entregado", async () => {
    const current = order({
      status: "DELIVERED",
      deliveredAt: new Date(),
    });
    const { service, tx } = harness(current);

    const result = await service.deliverFromQr(
      QR,
      "delivery-user",
    );

    expect(result).toMatchObject({
      status: "DELIVERED",
      alreadyDelivered: true,
    });
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
