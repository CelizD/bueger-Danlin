import { expect, test } from "@playwright/test";

const API_URL = "http://localhost:4000/api/v1";

async function inventorySnapshot(
  page: import("@playwright/test").Page,
) {
  return page.evaluate(async (apiUrl) => {
    const response = await fetch(
      `${apiUrl}/inventory/availability`,
      { cache: "no-store" },
    );
    const data = await response.json();

    return Object.fromEntries(
      data.items.map(
        (item: { key: string; available: number }) => [
          item.key,
          item.available,
        ],
      ),
    ) as Record<string, number>;
  }, API_URL);
}

function stockDelta(
  before: Record<string, number>,
  after: Record<string, number>,
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

test("pago MOCK desbloquea entrega gratis y cancelación reembolsa/restaura inventario", async ({
  page,
}) => {
  await page.goto("/");

  const inventoryBefore =
    await inventorySnapshot(page);

  await expect(
    page.getByRole("heading", {
      name: "Arma tu pedido.",
    }),
  ).toBeVisible();

  for (let index = 0; index < 4; index += 1) {
    await page
      .getByRole("button", {
        name: /Agregar combo/,
      })
      .click();
  }

  await expect(
    page.locator(".burger-card"),
  ).toHaveCount(5);

  await page
    .getByLabel("Nombre *")
    .fill("Cliente Reembolso");
  await page
    .getByLabel("Teléfono *")
    .fill("6645550123");
  await page
    .getByLabel("Correo (opcional)")
    .fill("refund.e2e@example.test");

  await page
    .getByLabel(/He leído y acepto los/)
    .check();
  await page
    .getByLabel(
      /Confirmo que soy mayor de edad/,
    )
    .check();
  await page
    .getByLabel(/Entiendo y acepto que/)
    .check();

  await page
    .getByRole("button", {
      name: "Continuar al pago",
    })
    .click();

  const orderHeading = page
    .getByRole("heading", { level: 1 })
    .filter({
      hasText: /^H-[A-F0-9]{8}$/,
    });

  await expect(orderHeading).toBeVisible();
  const orderCode =
    (await orderHeading.textContent())!.trim();

  let cancelled = false;

  try {
    const inventoryReserved =
      await inventorySnapshot(page);

    expect(
      stockDelta(
        inventoryBefore,
        inventoryReserved,
        "meat",
      ),
    ).toBe(5);
    expect(
      stockDelta(
        inventoryBefore,
        inventoryReserved,
        "fries",
      ),
    ).toBe(5);
    expect(
      stockDelta(
        inventoryBefore,
        inventoryReserved,
        "cheese",
      ),
    ).toBe(5);
    expect(
      stockDelta(
        inventoryBefore,
        inventoryReserved,
        "bacon",
      ),
    ).toBe(5);

    await page
      .getByRole("button", {
        name: "Simular pago local",
      })
      .click();

    await expect(
      page.getByText("Pago aprobado"),
    ).toBeVisible();

    const paidState = await page.evaluate(
      async ({ apiUrl, code }) => {
        const response = await fetch(
          `${apiUrl}/orders/${encodeURIComponent(code)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      { apiUrl: API_URL, code: orderCode },
    );

    expect(paidState.status).toBe(200);
    expect(paidState.body).toMatchObject({
      status: "PAID",
      paymentStatus: "PAID",
      groupDelivery: {
        freeDeliveryUnlocked: true,
        remainingPaidCombos: 0,
      },
    });
    expect(
      paidState.body.groupDelivery.paidComboCount,
    ).toBeGreaterThanOrEqual(5);

    await expect(
      page.getByText(
        "Envío gratis desbloqueado",
      ),
    ).toBeVisible();

    const cancellation =
      await page.evaluate(
        async ({ apiUrl, code }) => {
          const response = await fetch(
            `${apiUrl}/orders/${encodeURIComponent(code)}/cancel`,
            {
              method: "POST",
              credentials: "include",
            },
          );

          return {
            status: response.status,
            body: await response.json(),
          };
        },
        { apiUrl: API_URL, code: orderCode },
      );

    cancelled = true;

    expect(cancellation.status).toBe(201);
    expect(cancellation.body).toMatchObject({
      orderCode,
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      refundStatus: "REFUNDED",
      alreadyCancelled: false,
    });

    const refundedState =
      await page.evaluate(
        async ({ apiUrl, code }) => {
          const response = await fetch(
            `${apiUrl}/orders/${encodeURIComponent(code)}`,
            {
              credentials: "include",
              cache: "no-store",
            },
          );

          return {
            status: response.status,
            body: await response.json(),
          };
        },
        { apiUrl: API_URL, code: orderCode },
      );

    expect(refundedState.status).toBe(200);
    expect(refundedState.body).toMatchObject({
      status: "REFUNDED",
      paymentStatus: "REFUNDED",
      refundStatus: "REFUNDED",
      canCancel: false,
    });

    const inventoryRestored =
      await inventorySnapshot(page);

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
    if (!cancelled) {
      await page.evaluate(
        async ({ apiUrl, code }) => {
          await fetch(
            `${apiUrl}/orders/${encodeURIComponent(code)}/cancel`,
            {
              method: "POST",
              credentials: "include",
            },
          );
        },
        { apiUrl: API_URL, code: orderCode },
      );
    }
  }
});
