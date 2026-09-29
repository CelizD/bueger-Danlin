import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { updateAdminPickupEvent } from "./admin-pickup-event-mutations.js";

function event() {
  return {
    id: "event-1",
    code: "SAT-2030-09-07-UNIVERSIDAD",
    name: "Entrega Universidad",
    locationLabel: "Universidad",
    pickupPointId: "point-1",
    timezone: "America/Tijuana",
    startsAt: new Date(
      "2030-09-07T17:00:00.000Z",
    ),
    closesAt: new Date(
      "2030-09-05T23:00:00.000Z",
    ),
    maxCombos: 50,
    freeDeliveryMinPaidOrders: 5,
    transportCostCents: 15000,
    groupDeliveryFinalizedAt: null,
    status: "DRAFT",
    pickupPoint: {
      id: "point-1",
      code: "UNIVERSIDAD",
      name: "Universidad",
      address: null,
      latitude: null,
      longitude: null,
      active: true,
    },
  };
}

function harness(orderCount: number) {
  const tx = {
    pickupEvent: {
      findUnique: vi
        .fn()
        .mockResolvedValue(event()),
      update: vi.fn(),
    },
    pickupPoint: {
      update: vi.fn(),
    },
    order: {
      count: vi
        .fn()
        .mockResolvedValue(orderCount),
      aggregate: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (
        callback: (
          transaction: typeof tx,
        ) => unknown,
      ) => callback(tx),
    ),
  } as unknown as PrismaService;

  return { prisma, tx };
}

describe("updateAdminPickupEvent", () => {
  it("bloquea cambiar meta o traslado después del primer pedido", async () => {
    const { prisma, tx } =
      harness(1);

    await expect(
      updateAdminPickupEvent(
        prisma,
        "event-1",
        {
          freeDeliveryMinPaidOrders: 6,
          transportCostCents: 18000,
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      tx.order.count,
    ).toHaveBeenCalledWith({
      where: {
        pickupEventId: "event-1",
      },
    });
    expect(
      tx.order.aggregate,
    ).not.toHaveBeenCalled();
    expect(
      tx.pickupEvent.update,
    ).not.toHaveBeenCalled();
  });
});
