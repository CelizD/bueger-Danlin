import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { PickupEventsService } from "./pickup-events.service.js";

describe("PickupEventsService", () => {
  it("suma solo combos de pedidos pagados vigentes para la meta grupal", async () => {
    const now = new Date();
    const prisma = {
      pickupEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-1",
            code: "SAT-UNIVERSIDAD",
            name: "Universidad",
            locationLabel: "Universidad",
            timezone: "America/Tijuana",
            startsAt: new Date(now.getTime() + 3_600_000),
            closesAt: new Date(now.getTime() + 1_800_000),
            maxCombos: 50,
            freeDeliveryMinPaidCombos: 5,
            transportCostCents: 10_000,
            status: "OPEN",
            pickupPoint: {
              id: "point-1",
              code: "UNIVERSIDAD",
              name: "Universidad",
              address: null,
              latitude: null,
              longitude: null,
              active: true,
            },
            orders: [
              {
                status: "PAID",
                paymentStatus: "PAID",
                comboQuantity: 1,
                reservationExpiresAt: null,
              },
              {
                status: "READY",
                paymentStatus: "PAID",
                comboQuantity: 2,
                reservationExpiresAt: null,
              },
              {
                status: "CANCELLED",
                paymentStatus: "PAID",
                comboQuantity: 1,
                reservationExpiresAt: null,
              },
              {
                status: "PENDING_PAYMENT",
                paymentStatus: "PENDING",
                comboQuantity: 1,
                reservationExpiresAt: new Date(
                  now.getTime() + 900_000,
                ),
              },
            ],
          },
        ]),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new PickupEventsService(prisma);
    const [event] = await service.getOpen();

    expect(event?.reservedCombos).toBe(4);
    expect(event?.groupDelivery).toEqual({
      minPaidCombos: 5,
      paidComboCount: 3,
      remainingPaidCombos: 2,
      transportCostCents: 10_000,
      estimatedDeliveryFeeCents: 5_000,
      freeDeliveryUnlocked: false,
    });
  });

  it("deja el costo por persona sin estimar mientras no haya pedidos pagados", async () => {
    const now = new Date();
    const prisma = {
      pickupEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-2",
            code: "SAT-CUCAPA",
            name: "Cucapá",
            locationLabel: "Cucapá",
            timezone: "America/Tijuana",
            startsAt: new Date(now.getTime() + 3_600_000),
            closesAt: new Date(now.getTime() + 1_800_000),
            maxCombos: 30,
            freeDeliveryMinPaidCombos: 5,
            transportCostCents: 10_000,
            status: "OPEN",
            pickupPoint: {
              id: "point-2",
              code: "CUCAPA",
              name: "Cucapá",
              address: null,
              latitude: null,
              longitude: null,
              active: true,
            },
            orders: [],
          },
        ]),
        update: vi.fn(),
      },
    } as unknown as PrismaService;

    const service = new PickupEventsService(prisma);
    const [event] = await service.getOpen();

    expect(
      event?.groupDelivery.estimatedDeliveryFeeCents,
    ).toBeNull();
  });
});
