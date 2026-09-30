import { expect, test } from "@playwright/test";
import { mockOrderingApi } from "./support/mock-ordering-api";

test.beforeEach(async ({ page }) => {
  await mockOrderingApi(page);
});

test("cliente crea pedido, paga y obtiene QR", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Arma tu pedido.",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "¿Dónde quieres recibir tu pedido?",
    }),
  ).toBeVisible();

  await expect(page.getByText("3 de 5 combos pagados")).toBeVisible();
  await expect(page.getByText("4 de 5 combos pagados")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir ubicación exacta" }).first(),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Elegir Universidad",
    })
    .click();

  await expect(page.getByText("Combo 1")).toBeVisible();

  await page.getByLabel("Nombre *").fill("Daniel");
  await page
    .getByLabel("Teléfono *")
    .fill("6641234567");
  await page
    .getByLabel("Correo (opcional)")
    .fill("daniel@example.com");

  await expect(
    page.getByText(
      "Aviso de privacidad simplificado",
    ),
  ).toBeVisible();

  const sellerDisclosure =
    page.getByLabel(
      "Datos del vendedor y soporte",
    );
  await expect(
    sellerDisclosure,
  ).toBeVisible();
  await expect(
    sellerDisclosure.getByText(
      "Información del vendedor",
    ),
  ).toBeVisible();
  await expect(
    sellerDisclosure.getByText(
      "RFC",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Aviso de Privacidad integral",
    }),
  ).toHaveAttribute(
    "href",
    "/privacidad",
  );

  const continueButton = page.getByRole("button", {
    name: "Continuar al pago",
  });

  await expect(continueButton).toBeDisabled();

  const termsLink = page.getByRole("link", {
    name: "Términos y Condiciones",
  });
  await expect(termsLink).toHaveAttribute(
    "href",
    "/terminos",
  );

  await page
    .getByLabel(/He leído y acepto los/)
    .check();
  await expect(continueButton).toBeDisabled();

  await page
    .getByLabel(/Entiendo y acepto que/)
    .check();

  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(
    page.getByRole("heading", {
      name: "H-TEST01",
    }),
  ).toBeVisible();

  await expect(
    page.getByText("3 de 5 combos pagados"),
  ).toBeVisible();
  await expect(
    page.getByText("Faltan 2 combos para envío gratis"),
  ).toBeVisible();

  const storedToken = await page.evaluate(() =>
    window.sessionStorage.getItem(
      "burger-danlin:order-token:H-TEST01",
    ),
  );

  expect(storedToken).toBe("opaque-e2e-token");

  await page
    .getByRole("button", {
      name: "Simular pago local",
    })
    .click();

  await expect(
    page.getByText("Pago local aprobado"),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", {
      name: "Presenta este QR",
    }),
  ).toBeVisible();

  await expect(
    page.getByLabel("QR de entrega"),
  ).toBeVisible();

  await expect(
    page.getByText("4 de 5 combos pagados"),
  ).toBeVisible();
  await expect(
    page.getByText("Falta 1 combo para envío gratis"),
  ).toBeVisible();
  await expect(page.getByText("$25", { exact: false })).toBeVisible();

  await page
    .getByRole("link", { name: "Administrar mi pedido" })
    .click();

  await expect(
    page.getByRole("heading", { name: "H-TEST01" }),
  ).toBeVisible();
  await expect(
    page.getByText("Pagado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("4 de 5 combos pagados"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir ubicación exacta" }),
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
    "comprobante-H-TEST01.pdf",
  );

  await expect(
    page.locator(".site-footer"),
  ).toBeVisible();
});

test("publica términos de compra, cancelación y reembolso", async ({ page }) => {
  await page.goto("/terminos");

  await expect(
    page.getByRole("heading", {
      name: "Términos y Condiciones",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Cancelación por el cliente",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Reembolsos",
    }),
  ).toBeVisible();
});

test("preselecciona el punto desde ?pickup para QR/cartel futuro", async ({
  page,
}) => {
  await page.goto("/?pickup=CUCAPA");

  await expect(
    page.getByRole("button", {
      name: "Punto seleccionado",
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Entrega", { exact: false }),
  ).toBeVisible();

  await expect(page.getByText("Cucapá", { exact: true }).first()).toBeVisible();
});

test("la navegación por teclado empieza en el skip link", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");

  const skipLink = page.locator(".skip-link");

  await expect(skipLink).toHaveText("Saltar al contenido");
  await expect(skipLink).toBeFocused();
});
