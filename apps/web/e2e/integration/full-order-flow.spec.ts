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
    page.getByText("1 de 5 combos pagados"),
  ).toBeVisible();
  await expect(
    page.getByText("Faltan 4 combos para envío gratis"),
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
