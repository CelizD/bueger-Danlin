import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import {
  createAdminPickupEvent,
  openAdminPickupEvent,
  updateAdminPickupEvent,
} from "./admin-pickup-event-mutations.js";

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

describe("group delivery capacity", () => {
  it("rechaza crear una entrega si la meta supera el límite de combos", async () => {
    const prisma = {
      $transaction: vi.fn(),
    } as unknown as PrismaService;

    await expect(
      createAdminPickupEvent(
        prisma,
        {
          locationLabel: "Universidad",
          startsAt:
            "2030-09-07T17:00:00.000Z",
          closesAt:
            "2030-09-05T23:00:00.000Z",
          maxCombos: 3,
          freeDeliveryMinPaidOrders: 5,
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      (prisma as unknown as {
        $transaction: ReturnType<
          typeof vi.fn
        >;
      }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it("rechaza bajar el cupo por debajo de la meta existente", async () => {
    const { prisma, tx } =
      harness(0);

    await expect(
      updateAdminPickupEvent(
        prisma,
        "event-1",
        {
          maxCombos: 3,
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      tx.order.aggregate,
    ).not.toHaveBeenCalled();
    expect(
      tx.pickupEvent.update,
    ).not.toHaveBeenCalled();
  });

  it("no abre una configuración heredada con meta imposible", async () => {
    const brokenEvent = {
      ...event(),
      maxCombos: 3,
      freeDeliveryMinPaidOrders: 5,
    };
    const tx = {
      pickupEvent: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            brokenEvent,
          ),
        update: vi.fn(),
      },
      order: {
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

    await expect(
      openAdminPickupEvent(
        prisma,
        "event-1",
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      tx.order.aggregate,
    ).not.toHaveBeenCalled();
    expect(
      tx.pickupEvent.update,
    ).not.toHaveBeenCalled();
  });
});

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
