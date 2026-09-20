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

  await expect(page.getByText("Combo 1")).toBeVisible();

  await page.getByLabel("Nombre *").fill("Daniel");
  await page
    .getByLabel("Teléfono *")
    .fill("6641234567");
  await page
    .getByLabel("Correo (opcional)")
    .fill("daniel@example.com");

  await page
    .getByRole("button", {
      name: "Continuar al pago",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "H-TEST01",
    }),
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
});

test("la navegación por teclado empieza en el skip link", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", {
    name: "Saltar al contenido",
  });

  await expect(skipLink).toBeFocused();
});
