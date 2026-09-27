import { describe, expect, it } from "vitest";
import {
  newBurger,
  orderTokenStorageKey,
  pickupQrPayload,
} from "./formatters";
import type { CreatedOrder } from "./types";

describe("ordering helpers", () => {
  it("crea un combo local con removidos iniciales y sin extras", () => {
    const burger = newBurger(["lettuce"]);

    expect(burger.localId).toEqual(expect.any(String));
    expect(burger.localId.length).toBeGreaterThan(10);
    expect(burger.removedIds).toEqual(["lettuce"]);
    expect(burger.extraIds).toEqual([]);
  });

  it("construye una clave de sesión aislada por código de pedido", () => {
    expect(orderTokenStorageKey("H-ABC123")).toBe(
      "burger-danlin:order-token:H-ABC123",
    );
  });

  it("genera el payload QR sin incluir datos personales", () => {
    const order: CreatedOrder = {
      orderCode: "H-ABC123",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      currency: "MXN",
      totalCents: 13_000,
      comboQuantity: 1,
      reservationExpiresAt: "2026-09-20T05:00:00.000Z",
      verificationToken: "opaque-verification-token",
      pickup: {
        locationLabel: "Universidad",
        startsAt: "2026-09-26T19:00:00.000Z",
        closesAt: "2026-09-26T04:00:00.000Z",
        timezone: "America/Tijuana",
      },
      groupDelivery: {
        minPaidOrders: 5,
        paidOrderCount: 4,
        remainingPaidOrders: 1,
        transportCostCents: 10_000,
        estimatedDeliveryFeeCents: 2_500,
        freeDeliveryUnlocked: false,
      },
    };

    const payload = pickupQrPayload(order);

    expect(payload).toBe(
      "BD1:H-ABC123:opaque-verification-token",
    );
    expect(payload).not.toContain("Universidad");
    expect(payload).not.toContain("MXN");
  });
});
