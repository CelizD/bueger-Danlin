import { expect, test } from "@playwright/test";

const API_URL = "http://localhost:4000/api/v1";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for integrated E2E tests`);
  }

  return value;
}

async function staffLogin(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  expectedPath: string,
) {
  await page.goto("/admin/login");

  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);

  await page
    .getByRole("button", { name: "Entrar al panel" })
    .click();

  await expect(page).toHaveURL((url) => url.pathname === expectedPath);
}

test("pedido real recorre cliente, cocina, QR y entrega", async ({
  page,
  browser,
}) => {
  const kitchenPassword = requiredEnv("E2E_KITCHEN_PASSWORD");
  const deliveryPassword = requiredEnv("E2E_DELIVERY_PASSWORD");

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Arma tu pedido." }),
  ).toBeVisible();

  await expect(page.getByText("Combo 1")).toBeVisible();

  await page
    .getByRole("button", { name: /Agregar combo/ })
    .click();

  const burgerCards = page.locator(".burger-card");
  await expect(burgerCards).toHaveCount(2);

  const firstBurger = burgerCards.nth(0);
  const secondBurger = burgerCards.nth(1);

  await firstBurger
    .getByRole("checkbox", { name: /^Lechuga/ })
    .uncheck();
  await firstBurger
    .getByRole("checkbox", { name: /^Queso$/ })
    .uncheck();
  await firstBurger
    .getByRole("checkbox", { name: /^Carne extra/ })
    .check();

  await secondBurger
    .getByRole("checkbox", { name: /^Tomate/ })
    .uncheck();
  await secondBurger
    .getByRole("checkbox", { name: /^Queso extra/ })
    .check();

  await page
    .getByRole("button", { name: "Agregar Coca-Cola" })
    .click();
  await page
    .getByRole("button", { name: "Agregar Coca-Cola" })
    .click();

  const inventoryBefore = await page.evaluate(
    async (apiUrl) => {
      const response = await fetch(`${apiUrl}/inventory/availability`, {
        cache: "no-store",
      });
      const data = await response.json();

      return Object.fromEntries(
        data.items.map((item: { key: string; available: number }) => [
          item.key,
          item.available,
        ]),
      ) as Record<string, number>;
    },
    API_URL,
  );

  await expect(
    page.getByRole("link", { name: "Abrir ubicación exacta" }),
  ).toBeVisible();

  await page.getByLabel("Nombre *").fill("Cliente Prueba");
  await page.getByLabel("Teléfono *").fill("6641234567");
  await page
    .getByLabel("Correo (opcional)")
    .fill("cliente.e2e@example.test");

  await expect(
    page.getByLabel(
      "Datos del vendedor y soporte",
    ),
  ).toBeVisible();

  const continueButton = page.getByRole("button", {
    name: "Continuar al pago",
  });

  await expect(continueButton).toBeDisabled();

  await page
    .getByLabel(/He leído y acepto los/)
    .check();
  await expect(continueButton).toBeDisabled();

  await page
    .getByLabel(/Confirmo que soy mayor de edad/)
    .check();
  await expect(continueButton).toBeDisabled();

  await page
    .getByLabel(/Entiendo y acepto que/)
    .check();

  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  const orderHeading = page
    .getByRole("heading", { level: 1 })
    .filter({ hasText: /^H-[A-F0-9]{8}$/ });

  await expect(orderHeading).toBeVisible();

  const orderCode = (await orderHeading.textContent())!.trim();

  const inventoryAfter = await page.evaluate(
    async (apiUrl) => {
      const response = await fetch(`${apiUrl}/inventory/availability`, {
        cache: "no-store",
      });
      const data = await response.json();

      return Object.fromEntries(
        data.items.map((item: { key: string; available: number }) => [
          item.key,
          item.available,
        ]),
      ) as Record<string, number>;
    },
    API_URL,
  );

  function stockDelta(key: string) {
    const before = inventoryBefore[key];
    const after = inventoryAfter[key];

    expect(before, `Inventario inicial faltante: ${key}`).toBeDefined();
    expect(after, `Inventario final faltante: ${key}`).toBeDefined();

    return before! - after!;
  }

  expect(stockDelta("meat")).toBe(3);
  expect(stockDelta("fries")).toBe(2);
  expect(stockDelta("cheese")).toBe(2);
  expect(stockDelta("bacon")).toBe(2);
  expect(stockDelta("coca-cola")).toBe(2);

  const storedOrderTokens =
    await page.evaluate(() =>
      Object.keys(window.sessionStorage).filter(
        (key) =>
          key.startsWith(
            "burger-danlin:order-token:",
          ),
      ),
    );

  expect(storedOrderTokens).toEqual([]);

  const customerCookies =
    await page.context().cookies(API_URL);
  const orderAccessCookie =
    customerCookies.find((cookie) =>
      cookie.name.startsWith(
        "burger_order_access_",
      ),
    );

  expect(orderAccessCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Strict",
  });

  await page
    .getByRole("button", { name: "Simular pago local" })
    .click();

  await expect(page.getByText("Pago aprobado")).toBeVisible();
  await expect(
    page.getByText(/\d+ de 5 combos pagados/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Faltan \d+ combos para envío gratis|Envío gratis desbloqueado/,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Presenta este QR" }),
  ).toBeVisible();
  await expect(page.getByLabel("QR de entrega")).toBeVisible();

  const customerState = await page.evaluate(
    async ({ apiUrl, code }) => {
      const [orderResponse, qrResponse] =
        await Promise.all([
          fetch(
            `${apiUrl}/orders/${encodeURIComponent(code)}`,
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
          fetch(
            `${apiUrl}/orders/${encodeURIComponent(code)}/delivery-qr`,
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
        ]);

      return {
        orderStatus: orderResponse.status,
        order: await orderResponse.json(),
        qrStatus: qrResponse.status,
        qr: await qrResponse.json(),
      };
    },
    {
      apiUrl: API_URL,
      code: orderCode,
    },
  );

  expect(customerState.orderStatus).toBe(200);
  expect(customerState.order).toMatchObject({
    orderCode,
    status: "PAID",
    paymentStatus: "PAID",
  });
  expect(customerState.qrStatus).toBe(200);
  expect(customerState.qr).toMatchObject({
    orderCode,
  });

  const qrPayload =
    customerState.qr.qrPayload as string;
  const qrParts = qrPayload.split(":");

  expect(qrParts).toHaveLength(3);
  expect(qrParts[0]).toBe("BD1");
  expect(qrParts[1]).toBe(orderCode);
  expect(qrParts[2]).toMatch(
    /^[A-Za-z0-9_-]{32,}$/,
  );

  const kitchenContext = await browser.newContext();
  const kitchenPage = await kitchenContext.newPage();

  await staffLogin(
    kitchenPage,
    "kitchen.e2e@example.test",
    kitchenPassword,
    "/admin/cocina",
  );

  const kitchenCard = kitchenPage
    .locator(".kitchen-card")
    .filter({ hasText: orderCode });

  await expect(kitchenCard).toBeVisible();

  const kitchenItems = kitchenCard.locator(".kitchen-item");
  await expect(kitchenItems).toHaveCount(3);

  const firstKitchenBurger = kitchenItems.nth(0);
  const secondKitchenBurger = kitchenItems.nth(1);
  const kitchenDrink = kitchenItems.nth(2);

  await expect(firstKitchenBurger).toContainText("Hamburguesa 1");
  await expect(firstKitchenBurger).toContainText("Incluye");
  await expect(firstKitchenBurger).toContainText("NO PONER");
  await expect(firstKitchenBurger).toContainText("Sin Lechuga");
  await expect(firstKitchenBurger).toContainText("Sin Queso");
  await expect(firstKitchenBurger).toContainText("+ Carne extra");
  await expect(firstKitchenBurger).not.toContainText("Sin Tomate");
  await expect(firstKitchenBurger).not.toContainText("+ Queso extra");

  await expect(secondKitchenBurger).toContainText("Hamburguesa 2");
  await expect(secondKitchenBurger).toContainText("Sin Tomate");
  await expect(secondKitchenBurger).toContainText("+ Queso extra");
  await expect(secondKitchenBurger).not.toContainText("Sin Lechuga");
  await expect(secondKitchenBurger).not.toContainText("+ Carne extra");
  await expect(kitchenDrink).toContainText("Coca-Cola");
  await expect(kitchenDrink).toContainText("× 2");

  await kitchenCard
    .getByRole("button", { name: "Preparar" })
    .click();

  await expect(
    kitchenPage
      .locator(".kitchen-card")
      .filter({ hasText: orderCode })
      .getByRole("button", { name: "Marcar listo" }),
  ).toBeVisible();

  await kitchenPage
    .locator(".kitchen-card")
    .filter({ hasText: orderCode })
    .getByRole("button", { name: "Marcar listo" })
    .click();

  await expect(
    kitchenPage
      .locator(".kitchen-card")
      .filter({ hasText: orderCode }),
  ).toContainText("Esperando entrega");

  await kitchenContext.close();

  const deliveryContext = await browser.newContext();
  const deliveryPage = await deliveryContext.newPage();

  await staffLogin(
    deliveryPage,
    "delivery.e2e@example.test",
    deliveryPassword,
    "/admin/entrega",
  );

  await expect(
    deliveryPage.locator(".delivery-card").filter({ hasText: orderCode }),
  ).toBeVisible();

  const scan = await deliveryPage.evaluate(
    async ({ apiUrl, qrPayload }) => {
      const response = await fetch(`${apiUrl}/staff/delivery/scan`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ qrPayload }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    },
    {
      apiUrl: API_URL,
      qrPayload,
    },
  );

  expect(scan.status).toBe(201);
  expect(scan.body).toMatchObject({
    orderCode,
    status: "DELIVERED",
    paymentStatus: "PAID",
    alreadyDelivered: false,
  });

  await deliveryPage.reload();

  await expect(
    deliveryPage
      .locator(".delivery-history-row")
      .filter({ hasText: orderCode }),
  ).toBeVisible();

  const finalOrder = await page.evaluate(
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

  expect(finalOrder.status).toBe(200);
  expect(finalOrder.body).toMatchObject({
    orderCode,
    status: "DELIVERED",
    paymentStatus: "PAID",
  });

  await deliveryContext.close();
});
