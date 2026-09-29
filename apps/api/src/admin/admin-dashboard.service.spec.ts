import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { AdminDashboardService } from "./admin-dashboard.service.js";

describe("AdminDashboardService", () => {
  it("resume el día completo entre varios puntos de entrega", async () => {
    const events = [
      {
        id: "event-universidad",
        code: "SAT-UNIVERSIDAD",
        name: "Universidad",
        locationLabel: "Universidad",
        startsAt: new Date("2026-10-03T18:00:00.000Z"),
        closesAt: new Date("2099-10-03T04:00:00.000Z"),
        status: "OPEN",
        freeDeliveryMinPaidCombos: 5,
        transportCostCents: 10_000,
        groupDeliveryFinalizedAt: null,
        groupDeliveryFinalPaidCombos: null,
        groupDeliveryFinalTransportCostCents: null,
        groupDeliveryFinalAssignedCents: null,
        groupDeliveryFinalFreeUnlocked: null,
        pickupPoint: {
          id: "point-1",
          code: "UNIVERSIDAD",
          name: "Universidad",
          address: "Entrada principal",
        },
      },
      {
        id: "event-cucapa",
        code: "SAT-CUCAPA",
        name: "Cucapá",
        locationLabel: "Cucapá",
        startsAt: new Date("2026-10-03T20:00:00.000Z"),
        closesAt: new Date("2099-10-03T04:00:00.000Z"),
        status: "CLOSED",
        freeDeliveryMinPaidCombos: 5,
        transportCostCents: 10_000,
        groupDeliveryFinalizedAt: new Date(
          "2026-10-03T04:00:00.000Z",
        ),
        groupDeliveryFinalPaidCombos: 2,
        groupDeliveryFinalTransportCostCents: 10_000,
        groupDeliveryFinalAssignedCents: 10_000,
        groupDeliveryFinalFreeUnlocked: false,
        pickupPoint: {
          id: "point-2",
          code: "CUCAPA",
          name: "Cucapá",
          address: "Punto Cucapá",
        },
      },
    ];

    const analyticsOrders = [
      {
        id: "order-u1",
        status: "PAID",
        paymentStatus: "PAID",
        totalCents: 13_000,
        comboQuantity: 1,
        createdAt: new Date(),
        pickupEventId: "event-universidad",
        pickupEvent: {
          id: "event-universidad",
          code: "SAT-UNIVERSIDAD",
          name: "Universidad",
          startsAt: events[0]!.startsAt,
        },
        items: [],
      },
    ];

    const dayOrders = [
      {
        id: "order-u1",
        orderCode: "H-U1",
        status: "PAID",
        paymentStatus: "PAID",
        totalCents: 13_000,
        comboQuantity: 1,
        pickupEventId: "event-universidad",
        groupDeliveryFinalFeeCents: null,
        customer: {
          name: "Ana",
          phone: "6641111111",
        },
      },
      {
        id: "order-u2",
        orderCode: "H-U2",
        status: "PREPARING",
        paymentStatus: "PAID",
        totalCents: 13_000,
        comboQuantity: 2,
        pickupEventId: "event-universidad",
        groupDeliveryFinalFeeCents: null,
        customer: {
          name: "Luis",
          phone: "6642222222",
        },
      },
      {
        id: "order-c1",
        orderCode: "H-C1",
        status: "READY",
        paymentStatus: "PAID",
        totalCents: 13_000,
        comboQuantity: 1,
        pickupEventId: "event-cucapa",
        groupDeliveryFinalFeeCents: 5_000,
        customer: {
          name: "Marta",
          phone: "6643333333",
        },
      },
      {
        id: "order-c2",
        orderCode: "H-C2",
        status: "PAID",
        paymentStatus: "PAID",
        totalCents: 13_000,
        comboQuantity: 1,
        pickupEventId: "event-cucapa",
        groupDeliveryFinalFeeCents: 5_000,
        customer: {
          name: "José",
          phone: "6644444444",
        },
      },
      {
        id: "order-pending",
        orderCode: "H-P1",
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        totalCents: 13_000,
        comboQuantity: 1,
        pickupEventId: "event-universidad",
        groupDeliveryFinalFeeCents: null,
        customer: {
          name: "Pendiente",
          phone: "6645555555",
        },
      },
    ];

    const prisma = {
      pickupEvent: {
        findMany: vi.fn().mockResolvedValue(events),
      },
      order: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce(analyticsOrders)
          .mockResolvedValueOnce(dayOrders),
      },
    } as unknown as PrismaService;

    const service = new AdminDashboardService(prisma);
    const result = await service.getDashboard("event-universidad");

    expect(result.day?.metrics).toEqual({
      totalOrders: 5,
      paidOrders: 4,
      pendingPaymentOrders: 1,
      combosToPrepare: 4,
      readyCombos: 1,
      receivedCents: 52_000,
      deliveryCashToCollectCents: 10_000,
    });

    expect(result.day?.groups).toHaveLength(2);
    expect(result.day?.groups[0]).toMatchObject({
      eventId: "event-universidad",
      paidOrders: 2,
      combosPaid: 3,
      combosToPrepare: 3,
      remainingPaidOrders: 3,
      estimatedFeeCents: 5_000,
      finalized: false,
    });
    expect(result.day?.groups[1]).toMatchObject({
      eventId: "event-cucapa",
      paidOrders: 2,
      readyCombos: 1,
      finalized: true,
      cashToCollectCents: 10_000,
    });

    expect(result.day?.deliveryCharges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderCode: "H-C1",
          customerName: "Marta",
          pickupPointName: "Cucapá",
          finalized: true,
          finalFeeCents: 5_000,
        }),
        expect.objectContaining({
          orderCode: "H-U1",
          customerName: "Ana",
          pickupPointName: "Universidad",
          finalized: false,
          estimatedFeeCents: 5_000,
        }),
      ]),
    );
  });
});
