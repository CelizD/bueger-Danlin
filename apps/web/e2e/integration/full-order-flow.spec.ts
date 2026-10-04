import { expect, test } from "@playwright/test";

const API_URL = "http://localhost:4000/api/v1";
const MAILPIT_URL = "http://localhost:8025";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for integrated E2E tests`);
  }

  return value;
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

async function receiptState(
  page: import("@playwright/test").Page,
  orderCode: string,
) {
  return page.evaluate(
    async ({ apiUrl, code }) => {
      const response = await fetch(
        `${apiUrl}/orders/${encodeURIComponent(code)}/receipt`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const text = new TextDecoder("windows-1252").decode(bytes);

      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
        length: bytes.length,
        prefix: text.slice(0, 8),
        text,
      };
    },
    {
      apiUrl: API_URL,
      code: orderCode,
    },
  );
}

async function waitForPurchaseEmail(
  request: import("@playwright/test").APIRequestContext,
  recipient: string,
  orderCode: string,
) {
  let messageId = "";

  await expect
    .poll(
      async () => {
        const response = await request.get(
          MAILPIT_URL + "/api/v1/search",
          {
            params: {
              query: `to:${recipient}`,
              limit: "20",
            },
          },
        );

        if (!response.ok()) {
          return false;
        }

        const mailbox = (await response.json()) as {
          messages?: Array<{
            ID: string;
            Subject: string;
            Attachments: number;
            To: Array<{
              Address: string;
              Name: string;
            }>;
          }>;
        };

        const message = mailbox.messages?.find(
          (candidate) =>
            candidate.Subject.includes(orderCode) &&
            candidate.To.some(
              (address) =>
                address.Address === recipient,
            ),
        );

        if (!message) {
          return false;
        }

        messageId = message.ID;
        return true;
      },
      {
        message:
          "Mailpit no recibió la confirmación de compra.",
        timeout: 15_000,
        intervals: [200, 500, 1_000],
      },
    )
    .toBe(true);

  const response = await request.get(
    MAILPIT_URL +
      "/api/v1/message/" +
      encodeURIComponent(messageId),
  );

  expect(response.status()).toBe(200);

  return (await response.json()) as {
    ID: string;
    Subject: string;
    Text: string;
    HTML: string;
    From: {
      Address: string;
      Name: string;
    };
    To: Array<{
      Address: string;
      Name: string;
    }>;
    ReplyTo: Array<{
      Address: string;
      Name: string;
    }>;
    Attachments: Array<{
      FileName: string;
      ContentType: string;
      PartID: string;
      Size: number;
    }>;
  };
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

  await page
    .getByRole("button", { name: /Agregar combo/ })
    .click();

  const burgerCards = page.locator(".burger-card");
  await expect(burgerCards).toHaveCount(2);

  const firstBurger = burgerCards.nth(0);
  const secondBurger = burgerCards.nth(1);

  const firstPreview =
    firstBurger.getByTestId("burger-preview");
  const secondPreview =
    secondBurger.getByTestId("burger-preview");

  const firstLettuce = firstPreview.locator(
    '[data-preview-layer="lettuce-1"]',
  );
  const firstMeat = firstPreview.locator(
    '[data-preview-layer="meat-1"]',
  );

  await expect(firstLettuce).toHaveCount(1);
  await expect(firstMeat).toHaveCount(1);

  await firstBurger
    .getByRole("button", {
      name: "Lechuga: sin ingrediente",
    })
    .click();

  await expect(firstLettuce).toHaveCount(0);

  const firstCheese = firstPreview.locator(
    '[data-preview-layer="cheese-1"]',
  );
  const firstBaconTwo = firstPreview.locator(
    '[data-preview-layer="bacon-2"]',
  );
  const firstOnion = firstPreview.locator(
    '[data-preview-layer^="white-onion-"]',
  );

  await firstBurger
    .getByRole("button", {
      name: "Queso: 4 porciones",
    })
    .click();

  await firstBurger
    .getByRole("button", {
      name: "Carne: 4 porciones",
    })
    .click();

  await firstBurger
    .getByRole("button", {
      name: "Tocino: 2 porciones",
    })
    .click();

  await firstBurger
    .getByRole("button", {
      name: "Cebolla: 3 porciones",
    })
    .click();

  await firstBurger
    .getByRole("button", {
      name: "Pepinillos: 2 porciones",
    })
    .click();

  const firstPickles = firstPreview.locator(
    '[data-preview-layer^="pickles-"]',
  );
  const firstMayonnaise = firstPreview.locator(
    'use[href="/burger-preview/ingredients-sprite.svg#ketchup-mustard-mayonnaise"]',
  );

  await firstBurger
    .getByRole("button", {
      name: "Mayonesa: Sí",
    })
    .click();

  const firstMeatFour = firstPreview.locator(
    '[data-preview-layer="meat-4"]',
  );
  const firstCheeseFour = firstPreview.locator(
    '[data-preview-layer="cheese-4"]',
  );

  await expect(firstPickles).toHaveCount(2);
  await expect(firstMayonnaise).toHaveCount(1);
  await expect(firstMeat).toHaveCount(0);
  await expect(firstCheese).toHaveCount(0);
  await expect(firstMeatFour).toHaveCount(1);
  await expect(firstCheeseFour).toHaveCount(1);
  await expect(firstBaconTwo).toHaveCount(1);

  await expect
    .poll(async () =>
      firstMeatFour
        .locator("use")
        .evaluate((element) => {
          try {
            return (
              element as SVGGraphicsElement
            ).getBBox().width;
          } catch {
            return 0;
          }
        }),
    )
    .toBeGreaterThan(0);
  await expect(firstOnion).toHaveCount(3);
  await expect(firstBurger).toContainText(
    "$265",
  );

  const secondTomato = secondPreview.locator(
    '[data-preview-layer="tomato-1"]',
  );

  await expect(secondTomato).toHaveCount(1);

  await secondBurger
    .getByRole("button", {
      name: "Tomate: sin ingrediente",
    })
    .click();

  await expect(secondTomato).toHaveCount(0);

  const secondCheese = secondPreview.locator(
    '[data-preview-layer="cheese-1"]',
  );

  await expect(secondCheese).toHaveCount(1);

  await secondBurger
    .getByRole("button", {
      name: "Queso: 3 porciones",
    })
    .click();

  await expect(secondCheese).toHaveCount(0);
  await expect(
    secondPreview.locator(
      '[data-preview-layer="cheese-3"]',
    ),
  ).toHaveCount(1);

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

  expect(stockDelta("meat")).toBe(5);
  expect(stockDelta("fries")).toBe(2);
  expect(stockDelta("cheese")).toBe(7);
  expect(stockDelta("bacon")).toBe(3);
  expect(stockDelta("lettuce")).toBe(1);
  expect(stockDelta("tomato")).toBe(1);
  expect(stockDelta("onion")).toBe(4);
  expect(stockDelta("pickles")).toBe(2);
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
      /Falta 1 combo para envío gratis|Faltan \d+ combos para envío gratis|Envío gratis desbloqueado/,
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
    totalCents: 47_500,
  });
  expect(
    customerState.order.items[0]
      .preparationSnapshot.quantities,
  ).toEqual([
    "Carne ×4",
    "Queso ×4",
    "Tocino ×2",
    "Lechuga ×0",
    "Tomate ×1",
    "Cebolla ×3",
    "Pepinillos ×2",
  ]);
  expect(
    customerState.order.items[0]
      .preparationSnapshot.sauces,
  ).toContain("Mayonesa: Sí");

  const paidReceipt =
    await receiptState(page, orderCode);

  expect(paidReceipt.status).toBe(200);
  expect(paidReceipt.contentType).toContain("application/pdf");
  expect(paidReceipt.length).toBeGreaterThan(500);
  expect(paidReceipt.prefix).toBe("%PDF-1.4");
  expect(paidReceipt.text).toContain("COMPROBANTE DE COMPRA");
  expect(paidReceipt.text).toContain("Burger Danlin");
  expect(paidReceipt.text).toContain("Vendedor: Burger Danlin E2E");
  expect(paidReceipt.text).toContain("RFC: BDE260101AB1");
  expect(paidReceipt.text).toContain(
    "Domicilio: Avenida Pruebas 123, Tijuana, BC",
  );
  expect(paidReceipt.text).toContain(
    "Soporte: +52 664 555 0100 | soporte.e2e@example.test",
  );
  expect(paidReceipt.text).toContain(orderCode);
  expect(paidReceipt.text).toContain("Estado del pedido: Pagado");
  expect(paidReceipt.text).toContain("Estado del pago: Pagado");
  expect(paidReceipt.text).toContain("Combo Hamburguesa + Papas");
  expect(paidReceipt.text).toContain("Coca-Cola");
  expect(paidReceipt.text).toContain("Carne ×4");
  expect(paidReceipt.text).toContain("Queso ×4");
  expect(paidReceipt.text).toContain("Pepinillos ×2");
  expect(paidReceipt.text).toContain("Mayonesa: Sí");
  expect(paidReceipt.text).toContain("$475.00 MXN");
  expect(paidReceipt.text).toContain("Punto: Universidad");
  expect(paidReceipt.text).toContain("Punto de entrega E2E");
  expect(paidReceipt.text).toContain("%%EOF");

  const purchaseEmail =
    await waitForPurchaseEmail(
      request,
      "cliente.e2e@example.test",
      orderCode,
    );

  expect(purchaseEmail.Subject).toBe(
    `Pago confirmado · ${orderCode} · Burger Danlin`,
  );
  expect(purchaseEmail.From).toMatchObject({
    Address: "no-reply@burger-danlin.test",
    Name: "Burger Danlin",
  });
  expect(purchaseEmail.To).toContainEqual({
    Address: "cliente.e2e@example.test",
    Name: "",
  });
  expect(purchaseEmail.ReplyTo).toContainEqual({
    Address: "soporte.e2e@example.test",
    Name: "",
  });
  expect(purchaseEmail.Text).toContain(
    "Pago confirmado",
  );
  expect(purchaseEmail.Text).toContain(orderCode);
  expect(purchaseEmail.Text).toContain(
    "Total pagado: $475.00",
  );
  expect(purchaseEmail.Text).toContain(
    "Combo Hamburguesa + Papas",
  );
  expect(purchaseEmail.Text).toContain(
    "Coca-Cola",
  );
  expect(purchaseEmail.Text).toContain(
    "Universidad",
  );
  expect(purchaseEmail.HTML).toContain(
    "Adjuntamos tu comprobante de compra en PDF.",
  );

  expect(purchaseEmail.Attachments).toHaveLength(1);
  const emailReceipt =
    purchaseEmail.Attachments[0]!;

  expect(emailReceipt).toMatchObject({
    FileName: `comprobante-${orderCode}.pdf`,
    ContentType: "application/pdf",
  });
  expect(emailReceipt.Size).toBeGreaterThan(500);

  const emailReceiptResponse =
    await request.get(
      MAILPIT_URL +
        "/api/v1/message/" +
        encodeURIComponent(
          purchaseEmail.ID,
        ) +
        "/part/" +
        encodeURIComponent(
          emailReceipt.PartID,
        ),
    );

  expect(emailReceiptResponse.status()).toBe(200);
  expect(
    emailReceiptResponse.headers()[
      "content-type"
    ],
  ).toContain("application/pdf");

  const emailReceiptBuffer =
    await emailReceiptResponse.body();
  const emailReceiptText =
    emailReceiptBuffer.toString("latin1");

  expect(
    emailReceiptBuffer
      .subarray(0, 8)
      .toString("latin1"),
  ).toBe("%PDF-1.4");
  expect(emailReceiptText).toContain(orderCode);
  expect(emailReceiptText).toContain(
    "$475.00 MXN",
  );
  expect(emailReceiptText).toContain(
    "Vendedor: Burger Danlin E2E",
  );
  expect(emailReceiptText).toContain(
    "%%EOF",
  );

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
  await expect(firstKitchenBurger).toContainText("Cantidades");
  await expect(firstKitchenBurger).toContainText("Carne ×4");
  await expect(firstKitchenBurger).toContainText("Queso ×4");
  await expect(firstKitchenBurger).toContainText("Tocino ×2");
  await expect(firstKitchenBurger).toContainText("Lechuga ×0");
  await expect(firstKitchenBurger).toContainText("Tomate ×1");
  await expect(firstKitchenBurger).toContainText("Cebolla ×3");
  await expect(firstKitchenBurger).toContainText("Pepinillos ×2");
  await expect(firstKitchenBurger).toContainText("Aderezos");
  await expect(firstKitchenBurger).toContainText("Mayonesa: Sí");
  await expect(firstKitchenBurger).not.toContainText("Carne extra");

  await expect(secondKitchenBurger).toContainText("Hamburguesa 2");
  await expect(secondKitchenBurger).toContainText("Carne ×1");
  await expect(secondKitchenBurger).toContainText("Queso ×3");
  await expect(secondKitchenBurger).toContainText("Tomate ×0");
  await expect(secondKitchenBurger).not.toContainText("Queso extra");
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

  const preparingState =
    await customerOrderState(page, orderCode);

  expect(preparingState.status).toBe(200);
  expect(preparingState.body).toMatchObject({
    orderCode,
    status: "PREPARING",
    paymentStatus: "PAID",
  });

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

  const readyState =
    await customerOrderState(page, orderCode);

  expect(readyState.status).toBe(200);
  expect(readyState.body).toMatchObject({
    orderCode,
    status: "READY",
    paymentStatus: "PAID",
  });

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

  await page
    .getByRole("link", {
      name: "Administrar mi pedido",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: orderCode,
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Entregado", {
      exact: true,
    }),
  ).toBeVisible();

  const downloadPromise =
    page.waitForEvent("download");

  await page
    .getByRole("button", {
      name: "Descargar comprobante PDF",
    })
    .click();

  const download =
    await downloadPromise;

  expect(
    download.suggestedFilename(),
  ).toBe(
    `comprobante-${orderCode}.pdf`,
  );

  const stream =
    await download.createReadStream();
  const receiptChunks: Buffer[] = [];

  for await (const chunk of stream) {
    receiptChunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  const deliveredReceipt =
    Buffer.concat(receiptChunks);
  const deliveredReceiptText =
    deliveredReceipt.toString("latin1");

  expect(
    deliveredReceipt
      .subarray(0, 8)
      .toString("latin1"),
  ).toBe("%PDF-1.4");
  expect(deliveredReceipt.length).toBeGreaterThan(500);
  expect(deliveredReceiptText).toContain(
    "COMPROBANTE DE COMPRA",
  );
  expect(deliveredReceiptText).toContain("Burger Danlin");
  expect(deliveredReceiptText).toContain(
    "Vendedor: Burger Danlin E2E",
  );
  expect(deliveredReceiptText).toContain(
    "RFC: BDE260101AB1",
  );
  expect(deliveredReceiptText).toContain(
    "Domicilio: Avenida Pruebas 123, Tijuana, BC",
  );
  expect(deliveredReceiptText).toContain(
    "Soporte: +52 664 555 0100 | soporte.e2e@example.test",
  );
  expect(deliveredReceiptText).toContain(orderCode);
  expect(deliveredReceiptText).toContain(
    "Estado del pedido: Entregado",
  );
  expect(deliveredReceiptText).toContain(
    "Estado del pago: Pagado",
  );
  expect(deliveredReceiptText).toContain(
    "$475.00 MXN",
  );
  expect(deliveredReceiptText).toContain(
    "Punto: Universidad",
  );
  expect(deliveredReceiptText).toContain(
    "%%EOF",
  );

  await deliveryContext.close();
});
