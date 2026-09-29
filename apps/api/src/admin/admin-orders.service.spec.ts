import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { PaymentProviderRegistry } from "../payments/payment-provider.registry.js";
import { AdminOrdersService } from "./admin-orders.service.js";

describe("AdminOrdersService", () => {
  it("agrupa pedidos por punto y expone cobros finales", async () => {
    const prisma = {
      pickupEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "event-universidad",
            code: "SAT-UNIVERSIDAD",
            name: "Universidad",
            status: "CLOSED",
            startsAt: new Date("2026-10-03T19:00:00.000Z"),
            closesAt: new Date("2026-10-03T04:00:00.000Z"),
            freeDeliveryMinPaidCombos: 5,
            transportCostCents: 10_000,
            groupDeliveryFinalizedAt: new Date(
              "2026-10-03T04:00:00.000Z",
            ),
            groupDeliveryFinalPaidCombos: 3,
            groupDeliveryFinalTransportCostCents: 10_000,
            groupDeliveryFinalAssignedCents: 10_000,
            groupDeliveryFinalFreeUnlocked: false,
            pickupPoint: {
              id: "point-1",
              code: "UNIVERSIDAD",
              name: "Universidad",
              address: "Entrada principal",
            },
            orders: [
              {
                id: "order-a",
                status: "PAID",
                paymentStatus: "PAID",
                groupDeliveryFinalFeeCents: 3_334,
              },
              {
                id: "order-b",
                status: "READY",
                paymentStatus: "PAID",
                groupDeliveryFinalFeeCents: 3_333,
              },
              {
                id: "order-c",
                status: "CANCELLED",
                paymentStatus: "CANCELLED",
                groupDeliveryFinalFeeCents: null,
              },
            ],
          },
          {
            id: "event-cucapa",
            code: "SAT-CUCAPA",
            name: "Cucapá",
            status: "OPEN",
            startsAt: new Date("2026-10-10T19:00:00.000Z"),
            closesAt: new Date("2026-10-10T04:00:00.000Z"),
            freeDeliveryMinPaidCombos: 5,
            transportCostCents: 10_000,
            groupDeliveryFinalizedAt: null,
            groupDeliveryFinalPaidCombos: null,
            groupDeliveryFinalTransportCostCents: null,
            groupDeliveryFinalAssignedCents: null,
            groupDeliveryFinalFreeUnlocked: null,
            pickupPoint: {
              id: "point-2",
              code: "CUCAPA",
              name: "Cucapá",
              address: "Punto Cucapá",
            },
            orders: [
              {
                id: "order-d",
                status: "PAID",
                paymentStatus: "PAID",
                groupDeliveryFinalFeeCents: null,
              },
              {
                id: "order-e",
                status: "PAID",
                paymentStatus: "PAID",
                groupDeliveryFinalFeeCents: null,
              },
              {
                id: "order-f",
                status: "PAID",
                paymentStatus: "PAID",
                groupDeliveryFinalFeeCents: null,
              },
              {
                id: "order-g",
                status: "PAID",
                paymentStatus: "PAID",
                groupDeliveryFinalFeeCents: null,
              },
            ],
          },
        ]),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "order-a",
            orderCode: "H-A",
            status: "PAID",
            paymentStatus: "PAID",
            totalCents: 13_000,
            comboQuantity: 1,
            payments: [],
          },
          {
            id: "order-b",
            orderCode: "H-B",
            status: "READY",
            paymentStatus: "PAID",
            totalCents: 13_000,
            comboQuantity: 1,
            payments: [],
          },
          {
            id: "order-late",
            orderCode: "H-LATE",
            status: "CANCELLED",
            paymentStatus: "PAID",
            totalCents: 13_000,
            comboQuantity: 1,
            payments: [
              {
                provider: "MERCADOPAGO",
                status: "PAID",
                amountCents: 13_000,
                paidAt: new Date(),
                refundedAt: null,
                metadata: {
                  requiresManualRefund: true,
                  latePaymentReason:
                    "RESERVATION_EXPIRED",
                  latePaymentDetectedAt:
                    "2026-10-01T00:00:00.000Z",
                },
              },
            ],
          },
        ]),
      },
    } as unknown as PrismaService;

    const providers = {} as PaymentProviderRegistry;
    const service = new AdminOrdersService(
      prisma,
      providers,
    );
    const result = await service.listOrders();

    expect(result.groups[0]).toMatchObject({
      eventId: "event-universidad",
      paidOrderCount: 3,
      remainingPaidOrders: 2,
      finalized: true,
      cashToCollectCents: 6_667,
      estimatedFeeCents: null,
    });

    expect(result.groups[1]).toMatchObject({
      eventId: "event-cucapa",
      paidOrderCount: 4,
      remainingPaidOrders: 1,
      finalized: false,
      estimatedFeeCents: 2_500,
      cashToCollectCents: 0,
    });

    expect(result.summary).toMatchObject({
      paidOrders: 2,
      totalCombos: 2,
      paidRevenueCents: 26_000,
      finalDeliveryCashCents: 6_667,
      activeGroups: 1,
      manualRefundsPending: 1,
      manualRefundsPendingCents: 13_000,
    });

    expect(
      result.orders.find(
        (order) =>
          order.orderCode ===
          "H-LATE",
      )?.refundIssue,
    ).toMatchObject({
      required: true,
      amountCents: 13_000,
      provider: "MERCADOPAGO",
      reason:
        "RESERVATION_EXPIRED",
      lastAttemptFailed: false,
    });
  });
});
