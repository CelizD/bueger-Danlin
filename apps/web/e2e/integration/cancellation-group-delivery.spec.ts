import { expect, test } from "@playwright/test";

const API_URL = "http://localhost:4000/api/v1";

const CUSTOMER_NAMES = [
  "Cliente Uno",
  "Cliente Dos",
  "Cliente Tres",
  "Cliente Cuatro",
  "Cliente Cinco",
] as const;

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

async function createAndPaySingleCombo(
  browser: import("@playwright/test").Browser,
  index: number,
) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Arma tu pedido.",
    }),
  ).toBeVisible();

  await expect(
    page.locator(".burger-card"),
  ).toHaveCount(1);

  await page
    .getByLabel("Nombre *")
    .fill(CUSTOMER_NAMES[index]!);
  await page
    .getByLabel("Teléfono *")
    .fill(`66455501${String(index + 1).padStart(2, "0")}`);
  await page
    .getByLabel("Correo (opcional)")
    .fill(`group-${index + 1}@example.test`);

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

  await page
    .getByRole("button", {
      name: "Simular pago local",
    })
    .click();

  await expect(
    page.getByText("Pago aprobado"),
  ).toBeVisible();

  return {
    context,
    page,
    orderCode,
  };
}

async function customerOrderState(
  page: import("@playwright/test").Page,
  orderCode: string,
) {
  return page.evaluate(
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
    {
      apiUrl: API_URL,
      code: orderCode,
    },
  );
}

async function cancelOrder(
  page: import("@playwright/test").Page,
  orderCode: string,
) {
  return page.evaluate(
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
    {
      apiUrl: API_URL,
      code: orderCode,
    },
  );
}

test("varios pedidos llegan de 4/5 a 5/5, desbloquean envío gratis y reembolsan al cancelar", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);

  await page.goto("/");

  const inventoryBefore =
    await inventorySnapshot(page);

  const customers: Array<{
    context: import("@playwright/test").BrowserContext;
    page: import("@playwright/test").Page;
    orderCode: string;
  }> = [];

  try {
    for (let index = 0; index < 4; index += 1) {
      customers.push(
        await createAndPaySingleCombo(
          browser,
          index,
        ),
      );
    }

    const fourth = customers[3]!;

    await expect(
      fourth.page.getByText(
        "4 de 5 combos pagados",
      ),
    ).toBeVisible();
    await expect(
      fourth.page.getByText(
        "Falta 1 combo para envío gratis",
      ),
    ).toBeVisible();

    const belowGoal = await customerOrderState(
      fourth.page,
      fourth.orderCode,
    );

    expect(belowGoal.status).toBe(200);
    expect(belowGoal.body).toMatchObject({
      status: "PAID",
      paymentStatus: "PAID",
      groupDelivery: {
        minPaidCombos: 5,
        paidComboCount: 4,
        remainingPaidCombos: 1,
        transportCostCents: 10_000,
        estimatedDeliveryFeeCents: 2_500,
        freeDeliveryUnlocked: false,
      },
    });

    customers.push(
      await createAndPaySingleCombo(
        browser,
        4,
      ),
    );

    const fifth = customers[4]!;

    await expect(
      fifth.page.getByText(
        "5 de 5 combos pagados",
      ),
    ).toBeVisible();
    await expect(
      fifth.page.getByText(
        "Envío gratis desbloqueado",
      ),
    ).toBeVisible();

    const goalReached = await customerOrderState(
      fifth.page,
      fifth.orderCode,
    );

    expect(goalReached.status).toBe(200);
    expect(goalReached.body).toMatchObject({
      status: "PAID",
      paymentStatus: "PAID",
      groupDelivery: {
        minPaidCombos: 5,
        paidComboCount: 5,
        remainingPaidCombos: 0,
        transportCostCents: 10_000,
        estimatedDeliveryFeeCents: 0,
        freeDeliveryUnlocked: true,
      },
    });

    const inventoryWithFiveOrders =
      await inventorySnapshot(fifth.page);

    for (const key of [
      "meat",
      "fries",
      "cheese",
      "bacon",
    ]) {
      expect(
        inventoryBefore[key]! -
          inventoryWithFiveOrders[key]!,
        `Descuento incorrecto con 5 pedidos: ${key}`,
      ).toBe(5);
    }

    for (const customer of customers) {
      const cancellation = await cancelOrder(
        customer.page,
        customer.orderCode,
      );

      expect(cancellation.status).toBe(201);
      expect(cancellation.body).toMatchObject({
        orderCode: customer.orderCode,
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        refundStatus: "REFUNDED",
        alreadyCancelled: false,
      });
    }

    for (const customer of customers) {
      const refunded = await customerOrderState(
        customer.page,
        customer.orderCode,
      );

      expect(refunded.status).toBe(200);
      expect(refunded.body).toMatchObject({
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        refundStatus: "REFUNDED",
        canCancel: false,
      });
    }

    const inventoryRestored =
      await inventorySnapshot(fifth.page);

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
    for (const customer of customers) {
      try {
        const state = await customerOrderState(
          customer.page,
          customer.orderCode,
        );

        if (
          state.body?.status !== "REFUNDED" &&
          state.body?.status !== "CANCELLED"
        ) {
          await cancelOrder(
            customer.page,
            customer.orderCode,
          );
        }
      } catch {
        // Limpieza best-effort; la aserción original conserva el error real.
      }

      await customer.context.close();
    }
  }
});
