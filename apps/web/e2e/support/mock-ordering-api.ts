import type { Page, Route } from "@playwright/test";

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers":
    "content-type,idempotency-key,x-order-token,x-request-id",
};

async function json(
  route: Route,
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

export async function mockOrderingApi(page: Page) {
  let mockPaid = false;
  let selectedPickup: "Universidad" | "Cucapá" = "Universidad";

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
      });
      return;
    }

    if (path.endsWith("/catalog") && method === "GET") {
      await json(route, [
        {
          id: "combo-1",
          slug: "hamburguesa-papas",
          name: "Hamburguesa + papas",
          description: "Combo de prueba E2E",
          type: "COMBO",
          priceCents: 13000,
          modifierGroups: [
            {
              modifierGroup: {
                id: "ingredients",
                name: "Ingredientes",
                active: true,
                options: [
                  {
                    id: "lettuce",
                    name: "Lechuga",
                    kind: "REMOVABLE",
                    priceDeltaCents: 0,
                    defaultSelected: true,
                  },
                  {
                    id: "cheese-extra",
                    name: "Queso extra",
                    kind: "EXTRA",
                    priceDeltaCents: 1000,
                    defaultSelected: false,
                  },
                ],
              },
            },
          ],
        },
        {
          id: "coke-1",
          slug: "coca-cola-lata",
          name: "Coca-Cola lata",
          description: null,
          type: "BEVERAGE",
          priceCents: 3000,
          modifierGroups: [],
        },
      ]);
      return;
    }

    if (
      path.endsWith("/pickup-events/open") &&
      method === "GET"
    ) {
      await json(route, [
        {
          id: "event-1",
          code: "SAT-E2E-UNIVERSIDAD",
          name: "Universidad E2E",
          locationLabel: "Universidad",
          pickupPoint: {
            id: "point-1",
            code: "UNIVERSIDAD",
            name: "Universidad",
            address: "Entrada principal",
            latitude: 32.5149,
            longitude: -117.0382,
          },
          timezone: "America/Tijuana",
          startsAt: "2026-09-26T19:00:00.000Z",
          closesAt: "2026-09-26T04:00:00.000Z",
          maxCombos: 50,
          reservedCombos: 2,
          remainingCombos: 48,
          status: "OPEN",
          groupDelivery: {
            minPaidCombos: 5,
            paidComboCount: 3,
            remainingPaidCombos: 2,
            transportCostCents: 10000,
            estimatedDeliveryFeeCents: 3334,
            freeDeliveryUnlocked: false,
          },
        },
        {
          id: "event-2",
          code: "SAT-E2E-CUCAPA",
          name: "Cucapá E2E",
          locationLabel: "Cucapá",
          pickupPoint: {
            id: "point-2",
            code: "CUCAPA",
            name: "Cucapá",
            address: "Punto Cucapá",
            latitude: 32.4906,
            longitude: -116.9369,
          },
          timezone: "America/Tijuana",
          startsAt: "2026-09-26T20:00:00.000Z",
          closesAt: "2026-09-26T04:00:00.000Z",
          maxCombos: 30,
          reservedCombos: 1,
          remainingCombos: 29,
          status: "OPEN",
          groupDelivery: {
            minPaidCombos: 5,
            paidComboCount: 4,
            remainingPaidCombos: 1,
            transportCostCents: 10000,
            estimatedDeliveryFeeCents: 2500,
            freeDeliveryUnlocked: false,
          },
        },
      ]);
      return;
    }

    if (
      path.endsWith("/inventory/availability") &&
      method === "GET"
    ) {
      await json(route, {
        items: [],
        productLimits: {
          "combo-1": 48,
          "coke-1": 20,
        },
        modifierLimits: {
          lettuce: 48,
          "cheese-extra": 20,
        },
      });
      return;
    }

    if (path.endsWith("/orders") && method === "POST") {
      const input = request.postDataJSON() as {
        pickupEventId?: string;
        groupDeliveryTermsAccepted?: boolean;
      };

      if (input.groupDeliveryTermsAccepted !== true) {
        await json(
          route,
          {
            message:
              "Debes aceptar las condiciones de entrega grupal antes de continuar.",
          },
          400,
        );
        return;
      }

      const isCucapa = input.pickupEventId === "event-2";
      selectedPickup = isCucapa ? "Cucapá" : "Universidad";
      mockPaid = false;

      await json(route, {
        orderCode: "H-TEST01",
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        currency: "MXN",
        totalCents: 13000,
        comboQuantity: 1,
        reservationExpiresAt: "2026-09-20T05:30:00.000Z",
        verificationToken: "opaque-e2e-token",
        pickup: {
          locationLabel: isCucapa ? "Cucapá" : "Universidad",
          startsAt: isCucapa
            ? "2026-09-26T20:00:00.000Z"
            : "2026-09-26T19:00:00.000Z",
          closesAt: "2026-09-26T04:00:00.000Z",
          timezone: "America/Tijuana",
        },
        groupDelivery: {
          minPaidCombos: 5,
          paidComboCount: isCucapa ? 4 : 3,
          remainingPaidCombos: isCucapa ? 1 : 2,
          transportCostCents: 10000,
          estimatedDeliveryFeeCents: isCucapa ? 2500 : 3334,
          freeDeliveryUnlocked: false,
        },
      });
      return;
    }

    if (
      path.endsWith("/payments/mock/H-TEST01/confirm") &&
      method === "POST"
    ) {
      mockPaid = true;
      await json(route, {
        status: "CONFIRMED",
        paymentStatus: "PAID",
      });
      return;
    }

    if (
      path.endsWith("/orders/H-TEST01") &&
      method === "GET"
    ) {
      const isCucapa = selectedPickup === "Cucapá";
      const paidOrderCount = mockPaid
        ? isCucapa
          ? 5
          : 4
        : isCucapa
          ? 4
          : 3;
      const paidComboCount =
        paidOrderCount;
      const freeDeliveryUnlocked =
        paidComboCount >= 5;

      await json(route, {
        orderCode: "H-TEST01",
        status: mockPaid ? "PAID" : "PENDING_PAYMENT",
        paymentStatus: mockPaid ? "PAID" : "PENDING",
        currency: "MXN",
        totalCents: 13000,
        comboQuantity: 1,
        createdAt: "2026-09-20T05:00:00.000Z",
        cancelledAt: null,
        canCancel: true,
        cancellationDeadline: "2026-09-26T04:00:00.000Z",
        refundStatus: null,
        pickup: {
          locationLabel: selectedPickup,
          startsAt: isCucapa
            ? "2026-09-26T20:00:00.000Z"
            : "2026-09-26T19:00:00.000Z",
          closesAt: "2026-09-26T04:00:00.000Z",
          timezone: "America/Tijuana",
          pickupPoint: {
            code: isCucapa ? "CUCAPA" : "UNIVERSIDAD",
            name: selectedPickup,
            address: isCucapa ? "Punto Cucapá" : "Entrada principal",
            latitude: isCucapa ? 32.4906 : 32.5149,
            longitude: isCucapa ? -116.9369 : -117.0382,
          },
        },
        groupDelivery: {
          minPaidCombos: 5,
          paidComboCount,
          remainingPaidCombos: Math.max(0, 5 - paidComboCount),
          transportCostCents: 10000,
          estimatedDeliveryFeeCents: freeDeliveryUnlocked
            ? 0
            : Math.ceil(10000 / paidOrderCount),
          freeDeliveryUnlocked,
        },
        items: [],
      });
      return;
    }

    if (
      path.endsWith("/orders/H-TEST01/cancel") &&
      method === "POST"
    ) {
      await json(route, {
        status: "CANCELLED",
        paymentStatus: "PENDING",
        refundStatus: null,
      });
      return;
    }

    await json(
      route,
      {
        message: `E2E mock sin respuesta para ${method} ${path}`,
      },
      404,
    );
  });
}
