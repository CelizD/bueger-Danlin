import {
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import { CustomerOrdersService } from "./customer-orders.service.js";

const TOKEN = "customer-order-token-for-tests";
const TOKEN_HASH = createHash("sha256")
  .update(TOKEN)
  .digest("hex");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    pickupEventId: "event-1",
    verificationTokenHash: TOKEN_HASH,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    reservationExpiresAt: new Date(Date.now() + 15 * 60_000),
    cancelledAt: null,
    payments: [],
    pickupEvent: {
      id: "event-1",
      status: "OPEN",
      maxCombos: 50,
      closesAt: new Date(Date.now() + 60 * 60_000),
    },
    ...overrides,
  };
}

function harness(currentOrder: ReturnType<typeof order>) {
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ id: currentOrder.id }]),
    order: {
      findUnique: vi.fn().mockResolvedValue(currentOrder),
      update: vi.fn().mockResolvedValue(undefined),
      aggregate: vi
        .fn()
        .mockResolvedValue({ _sum: { comboQuantity: 0 } }),
    },
    payment: {
      update: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    pickupEvent: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    ),
  } as unknown as PrismaService;

  const inventory = {
    releaseOrder: vi.fn().mockResolvedValue(undefined),
  } as unknown as InventoryService;

  return {
    service: new CustomerOrdersService(prisma, inventory),
    inventory,
    tx,
  };
}

describe("CustomerOrdersService.getOrder", () => {
  it("devuelve progreso grupal vivo y costo estimado", async () => {
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          orderCode: "H-A1B2C3D4",
          pickupEventId: "event-1",
          verificationTokenHash: TOKEN_HASH,
          status: "PAID",
          paymentStatus: "PAID",
          currency: "MXN",
          totalCents: 13_000,
          comboQuantity: 1,
          createdAt: new Date(),
          cancelledAt: null,
          payments: [],
          items: [],
          pickupEvent: {
            id: "event-1",
            locationLabel: "Universidad",
            startsAt: new Date(Date.now() + 2 * 60 * 60_000),
            closesAt: new Date(Date.now() + 60 * 60_000),
            timezone: "America/Tijuana",
            freeDeliveryMinPaidOrders: 5,
            transportCostCents: 10_000,
            pickupPoint: {
              code: "UNIVERSIDAD",
              name: "Universidad",
              address: "Entrada principal",
            },
          },
        }),
        count: vi.fn().mockResolvedValue(4),
      },
    } as unknown as PrismaService;

    const service = new CustomerOrdersService(
      prisma,
      {} as InventoryService,
    );

    const result = await service.getOrder(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(result.groupDelivery).toEqual({
      minPaidOrders: 5,
      paidOrderCount: 4,
      remainingPaidOrders: 1,
      transportCostCents: 10_000,
      estimatedDeliveryFeeCents: 2_500,
      freeDeliveryUnlocked: false,
      finalized: false,
      finalizedAt: undefined,
      finalFeeCents: undefined,
    });
    expect(result.pickup.pickupPoint).toEqual({
      code: "UNIVERSIDAD",
      name: "Universidad",
      address: "Entrada principal",
    });
  });

  it("devuelve el cargo final congelado después del cierre", async () => {
    const finalizedAt = new Date("2026-10-03T04:00:00.000Z");
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          orderCode: "H-A1B2C3D4",
          pickupEventId: "event-1",
          verificationTokenHash: TOKEN_HASH,
          status: "PAID",
          paymentStatus: "PAID",
          currency: "MXN",
          totalCents: 13_000,
          comboQuantity: 1,
          createdAt: new Date(),
          cancelledAt: null,
          groupDeliveryFinalFeeCents: 3_334,
          payments: [],
          items: [],
          pickupEvent: {
            id: "event-1",
            locationLabel: "Universidad",
            startsAt: new Date(Date.now() + 2 * 60 * 60_000),
            closesAt: new Date(Date.now() - 60_000),
            timezone: "America/Tijuana",
            freeDeliveryMinPaidOrders: 5,
            transportCostCents: 10_000,
            groupDeliveryFinalizedAt: finalizedAt,
            groupDeliveryFinalPaidOrders: 3,
            groupDeliveryFinalTransportCostCents: 10_000,
            groupDeliveryFinalFreeUnlocked: false,
            pickupPoint: {
              code: "UNIVERSIDAD",
              name: "Universidad",
              address: "Entrada principal",
            },
          },
        }),
        count: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new CustomerOrdersService(
      prisma,
      {} as InventoryService,
    );

    const result = await service.getOrder(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(result.groupDelivery).toEqual({
      minPaidOrders: 5,
      paidOrderCount: 3,
      remainingPaidOrders: 2,
      transportCostCents: 10_000,
      estimatedDeliveryFeeCents: 3_334,
      freeDeliveryUnlocked: false,
      finalized: true,
      finalizedAt,
      finalFeeCents: 3_334,
    });
    expect(prisma.order.count).not.toHaveBeenCalled();
  });
});

describe("CustomerOrdersService.cancel", () => {
  it("rechaza cancelar cuando el grupo ya fue finalizado", async () => {
    const current = order({
      pickupEvent: {
        id: "event-1",
        status: "CLOSED",
        maxCombos: 50,
        closesAt: new Date(Date.now() + 60 * 60_000),
        groupDeliveryFinalizedAt: new Date(),
      },
    });
    const { service, tx, inventory } = harness(current);

    await expect(
      service.cancel("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(inventory.releaseOrder).not.toHaveBeenCalled();
  });

  it("rechaza el token antes de modificar el pedido", async () => {
    const current = order();
    const { service, tx, inventory } = harness(current);

    await expect(
      service.cancel("H-A1B2C3D4", "token-incorrecto"),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tx.order.update).not.toHaveBeenCalled();
    expect(inventory.releaseOrder).not.toHaveBeenCalled();
  });

  it("cancela un pedido no pagado y libera su inventario", async () => {
    const current = order();
    const { service, tx, inventory } = harness(current);

    const result = await service.cancel(
      " h-a1b2c3d4 ",
      TOKEN,
    );

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: { status: "CANCELLED" },
    });
    expect(inventory.releaseOrder).toHaveBeenCalledWith(
      tx,
      "order-1",
    );
    expect(result).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "CANCELLED",
      refundStatus: null,
      alreadyCancelled: false,
    });
  });

  it("reembolsa un pago MOCK y libera el inventario", async () => {
    const current = order({
      status: "PAID",
      paymentStatus: "PAID",
      payments: [
        {
          id: "payment-1",
          status: "PAID",
          provider: "MOCK",
          metadata: null,
        },
      ],
    });
    const { service, tx, inventory } = harness(current);

    const result = await service.cancel(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1" },
        data: expect.objectContaining({
          status: "REFUNDED",
          refundedAt: expect.any(Date),
          metadata: expect.objectContaining({
            refundStatus: "completed",
            refundReason:
              "customer_cancelled_before_cutoff",
          }),
        }),
      }),
    );
    expect(inventory.releaseOrder).toHaveBeenCalledWith(
      tx,
      "order-1",
    );
    expect(result).toMatchObject({
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      refundStatus: "REFUNDED",
    });
  });

  it("marca un reembolso real como pendiente pero deja de reservar inventario", async () => {
    const current = order({
      status: "PAID",
      paymentStatus: "PAID",
      payments: [
        {
          id: "payment-1",
          status: "PAID",
          provider: "MERCADOPAGO",
          externalId: "ORDTST01",
          amountCents: 13_000,
          metadata: { providerOrder: "ORDTST01" },
        },
      ],
    });
    const { service, tx, inventory } = harness(current);

    const result = await service.cancel(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1" },
        data: {
          metadata: expect.objectContaining({
            providerOrder: "ORDTST01",
            refundStatus: "requested",
            refundReason:
              "customer_cancelled_before_cutoff",
          }),
        },
      }),
    );
    expect(inventory.releaseOrder).toHaveBeenCalledWith(
      tx,
      "order-1",
    );
    expect(result).toMatchObject({
      status: "CANCELLED",
      paymentStatus: "PAID",
      refundStatus: "PENDING",
    });
  });

  it("no permite cancelar un pedido ya entregado", async () => {
    const current = order({
      status: "DELIVERED",
      paymentStatus: "PAID",
    });
    const { service, inventory } = harness(current);

    await expect(
      service.cancel("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(inventory.releaseOrder).not.toHaveBeenCalled();
  });

  it("una cancelación repetida no vuelve a liberar inventario", async () => {
    const current = order({
      status: "CANCELLED",
      paymentStatus: "CANCELLED",
    });
    const { service, inventory } = harness(current);

    const result = await service.cancel(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(result).toMatchObject({
      alreadyCancelled: true,
      status: "CANCELLED",
    });
    expect(inventory.releaseOrder).not.toHaveBeenCalled();
  });
});
