import {
  expect,
  request as playwrightRequest,
  test,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

const API_URL = "http://localhost:4000/api/v1";
const APP_ORIGIN = "http://localhost:3101";

type InventorySnapshot = Record<string, number>;

async function inventorySnapshot(
  client: import("@playwright/test").APIRequestContext,
) {
  const response = await client.get(
    "/inventory/availability",
  );

  expect(response.status()).toBe(200);

  const data = (await response.json()) as {
    items: Array<{
      key: string;
      available: number;
    }>;
  };

  return Object.fromEntries(
    data.items.map((item) => [
      item.key,
      item.available,
    ]),
  ) as InventorySnapshot;
}

function stockDelta(
  before: InventorySnapshot,
  after: InventorySnapshot,
  key: string,
) {
  const initial = before[key];
  const current = after[key];

  expect(
    initial,
    `Inventario inicial faltante: ${key}`,
  ).toBeDefined();
  expect(
    current,
    `Inventario final faltante: ${key}`,
  ).toBeDefined();

  return initial! - current!;
}

test("dos POST simultáneos con la misma Idempotency-Key crean un solo pedido", async () => {
  const commonHeaders = {
    Origin: APP_ORIGIN,
    "Sec-Fetch-Site": "same-site",
  };

  const clientA = await playwrightRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: commonHeaders,
  });
  const clientB = await playwrightRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: commonHeaders,
  });

  try {
    const [
      catalogResponse,
      eventsResponse,
    ] = await Promise.all([
      clientA.get("/catalog"),
      clientA.get("/pickup-events/open"),
    ]);

    expect(catalogResponse.status()).toBe(200);
    expect(eventsResponse.status()).toBe(200);

    const catalog = (await catalogResponse.json()) as Array<{
      id: string;
      type: string;
    }>;
    const events = (await eventsResponse.json()) as Array<{
      id: string;
    }>;

    const combo = catalog.find(
      (product) => product.type === "COMBO",
    );
    const event = events[0];

    expect(combo).toBeDefined();
    expect(event).toBeDefined();

    const inventoryBefore =
      await inventorySnapshot(clientA);

    const idempotencyKey =
      `e2e-idempotency-${randomUUID()}`;

    const orderPayload = {
      pickupEventId: event!.id,
      purchaseTermsAccepted: true,
      ageAuthorizationConfirmed: true,
      groupDeliveryTermsAccepted: true,
      customer: {
        name: "Cliente Idempotente",
        phone: "+526645550199",
        email:
          "idempotencia.concurrente@example.test",
      },
      items: [
        {
          productId: combo!.id,
          quantity: 1,
          removedModifierOptionIds: [],
          extraModifierOptionIds: [],
        },
      ],
    };

    const [firstResponse, secondResponse] =
      await Promise.all([
        clientA.post("/orders", {
          headers: {
            "Idempotency-Key":
              idempotencyKey,
          },
          data: orderPayload,
        }),
        clientB.post("/orders", {
          headers: {
            "Idempotency-Key":
              idempotencyKey,
          },
          data: orderPayload,
        }),
      ]);

    expect(firstResponse.status()).toBe(201);
    expect(secondResponse.status()).toBe(201);

    const firstOrder =
      await firstResponse.json();
    const secondOrder =
      await secondResponse.json();

    expect(firstOrder.orderCode).toMatch(
      /^H-[A-F0-9]{8}$/,
    );
    expect(secondOrder.orderCode).toBe(
      firstOrder.orderCode,
    );
    expect(secondOrder).toMatchObject({
      orderCode: firstOrder.orderCode,
      status: firstOrder.status,
      paymentStatus:
        firstOrder.paymentStatus,
      totalCents: firstOrder.totalCents,
      comboQuantity:
        firstOrder.comboQuantity,
    });

    const inventoryAfter =
      await inventorySnapshot(clientA);

    expect(
      stockDelta(
        inventoryBefore,
        inventoryAfter,
        "meat",
      ),
    ).toBe(1);
    expect(
      stockDelta(
        inventoryBefore,
        inventoryAfter,
        "fries",
      ),
    ).toBe(1);
    expect(
      stockDelta(
        inventoryBefore,
        inventoryAfter,
        "cheese",
      ),
    ).toBe(1);
    expect(
      stockDelta(
        inventoryBefore,
        inventoryAfter,
        "bacon",
      ),
    ).toBe(1);

    const conflictingResponse =
      await clientB.post("/orders", {
        headers: {
          "Idempotency-Key":
            idempotencyKey,
        },
        data: {
          ...orderPayload,
          customer: {
            ...orderPayload.customer,
            name: "Cliente Diferente",
          },
        },
      });

    expect(
      conflictingResponse.status(),
    ).toBe(409);

    const cancellation =
      await clientA.post(
        `/orders/${encodeURIComponent(firstOrder.orderCode)}/cancel`,
      );

    expect(cancellation.status()).toBe(201);

    const inventoryRestored =
      await inventorySnapshot(clientA);

    for (const key of [
      "meat",
      "fries",
      "cheese",
      "bacon",
      "coca-cola",
    ]) {
      expect(
        inventoryRestored[key],
        `Inventario no restaurado: ${key}`,
      ).toBe(inventoryBefore[key]);
    }
  } finally {
    await Promise.all([
      clientA.dispose(),
      clientB.dispose(),
    ]);
  }
});
