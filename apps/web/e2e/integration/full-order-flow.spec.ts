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
  request,
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
  const token = await page.evaluate((code) => {
    return window.sessionStorage.getItem(
      `burger-danlin:order-token:${code}`,
    );
  }, orderCode);

  expect(token).toBeTruthy();

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

  const paidOrder = await request.get(
    `${API_URL}/orders/${encodeURIComponent(orderCode)}`,
    {
      headers: {
        "x-order-token": token!,
      },
    },
  );

  expect(paidOrder.ok()).toBe(true);
  expect(await paidOrder.json()).toMatchObject({
    orderCode,
    status: "PAID",
    paymentStatus: "PAID",
  });

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
      qrPayload: `BD1:${orderCode}:${token}`,
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

  const finalOrder = await request.get(
    `${API_URL}/orders/${encodeURIComponent(orderCode)}`,
    {
      headers: {
        "x-order-token": token!,
      },
    },
  );

  expect(finalOrder.ok()).toBe(true);
  expect(await finalOrder.json()).toMatchObject({
    orderCode,
    status: "DELIVERED",
    paymentStatus: "PAID",
  });

  await deliveryContext.close();
});
