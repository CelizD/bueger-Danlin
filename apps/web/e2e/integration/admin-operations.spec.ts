import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { assertNoBlockingA11y } from "./accessibility-assertions";

const API_URL = "http://localhost:4000/api/v1";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for integrated E2E tests`);
  }

  return value;
}

function decodeBase32(secret: string) {
  const normalized = secret
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");

  let bits = "";

  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character);

    if (value < 0) {
      throw new Error("Invalid base32 MFA secret");
    }

    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(
      Number.parseInt(bits.slice(index, index + 8), 2),
    );
  }

  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const step = Math.floor(Date.now() / 1000 / 30);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

async function apiStatus(
  page: import("@playwright/test").Page,
  input: {
    method?: string;
    path: string;
    body?: unknown;
  },
) {
  return page.evaluate(
    async ({ apiUrl, method, path, body }) => {
      const response = await fetch(apiUrl + path, {
        method,
        credentials: "include",
        headers:
          body === undefined
            ? undefined
            : {
                "content-type": "application/json",
              },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
      });

      return response.status;
    },
    {
      apiUrl: API_URL,
      method: input.method ?? "GET",
      path: input.path,
      body: input.body,
    },
  );
}

async function loginAdminWithMfa(
  page: import("@playwright/test").Page,
) {
  const password = requiredEnv("E2E_ADMIN_PASSWORD");

  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill("admin.e2e@example.test");
  await page.getByLabel("Contraseña").fill(password);
  await page
    .getByRole("button", { name: "Entrar al panel" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Configura tu MFA" }),
  ).toBeVisible();

  const secret = (
    await page.locator(".admin-mfa-secret code").textContent()
  )?.trim();

  expect(secret).toBeTruthy();

  await page
    .getByLabel("Código del autenticador")
    .fill(currentTotp(secret!));
  await page
    .getByRole("button", { name: "Activar MFA" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Guarda tus códigos de recuperación",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Ya guardé mis códigos" })
    .click();

  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/dashboard",
  );
}

test("admin real cubre MFA, inventario, sábados, personal y ARCO", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);

  const suffix = Date.now().toString(36);
  const inventoryName = `Insumo E2E ${suffix}`;
  const staffName = `Operador E2E ${suffix}`;
  const staffEmail = `operador.${suffix}@example.test`;
  const pickupName = `Punto E2E ${suffix}`;
  const arcoName = `Titular E2E ${suffix}`;

  const arcoResponse = await request.post(
    `${API_URL}/privacy/arco`,
    {
      data: {
        name: arcoName,
        email: `arco.${suffix}@example.test`,
        phone: "+526641234567",
        rights: ["ACCESS"],
        description:
          "Solicito acceso a los datos personales asociados a mis compras de prueba.",
        locatorInfo: "Pedido de prueba E2E",
        identityVerificationAcknowledged: true,
      },
    },
  );

  expect(arcoResponse.status()).toBe(201);
  const arco = (await arcoResponse.json()) as {
    folio: string;
  };

  await loginAdminWithMfa(page);

  expect(
    await apiStatus(page, {
      path: "/staff/kitchen/orders",
    }),
  ).toBe(403);

  expect(
    await apiStatus(page, {
      path: "/staff/delivery/orders",
    }),
  ).toBe(403);

  await expect(
    page.getByRole("link", { name: "Cocina" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Entrega" }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("heading", {
      name: "Panel del día",
      level: 1,
    }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Dashboard");

  await page.goto("/admin/pedidos");
  await expect(
    page.getByRole("heading", {
      name: "Pedidos",
      level: 1,
    }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Pedidos");

  await page.goto("/admin/inventario");
  await expect(
    page.getByRole("heading", { name: "Inventario" }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Inventario");

  await page
    .getByRole("button", { name: "Nuevo artículo" })
    .click();

  const inventoryForm = page.locator(".inventory-create-form");
  await inventoryForm.getByLabel("Nombre").fill(inventoryName);
  await inventoryForm.getByLabel("Unidad").fill("pieza");
  await inventoryForm.getByLabel("Stock inicial").fill("12");
  await inventoryForm
    .getByLabel("Alerta de stock bajo")
    .fill("3");
  await inventoryForm
    .getByRole("button", { name: "Agregar artículo" })
    .click();

  await expect(
    page.getByText(`${inventoryName} agregado al inventario.`),
  ).toBeVisible();

  let inventoryCard = page
    .locator(".inventory-card")
    .filter({ hasText: inventoryName });

  await expect(inventoryCard).toBeVisible();
  await inventoryCard
    .getByLabel("Disponible ahora")
    .fill("18");
  await inventoryCard
    .getByRole("button", { name: "Guardar cambios" })
    .click();

  await expect(
    page.getByText(`${inventoryName} actualizado correctamente.`),
  ).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  inventoryCard = page
    .locator(".inventory-card")
    .filter({ hasText: inventoryName });
  await inventoryCard
    .getByRole("button", { name: "Eliminar" })
    .click();

  await expect(
    page.getByText(`${inventoryName} eliminado del inventario.`),
  ).toBeVisible();
  await expect(
    page.locator(".inventory-card").filter({ hasText: inventoryName }),
  ).toHaveCount(0);

  await page.goto("/admin/sabados");
  await expect(
    page.getByRole("heading", { name: "Sábados" }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Sábados");

  await page
    .getByRole("button", { name: "Nueva fecha" })
    .click();

  const saturdayForm = page.locator(".saturday-form");
  await saturdayForm
    .getByLabel("Lugar de entrega")
    .fill(pickupName);
  await saturdayForm
    .getByLabel("Dirección exacta del punto")
    .fill("Av. Universidad 123, Tijuana, BC");
  await saturdayForm
    .getByLabel("Latitud exacta")
    .fill("32.5149");
  await saturdayForm
    .getByLabel("Longitud exacta")
    .fill("-117.0382");
  await saturdayForm
    .getByRole("button", { name: "Crear borrador" })
    .click();

  await expect(
    page.getByText("La nueva entrega se creó como borrador."),
  ).toBeVisible();

  const saturdayCard = page
    .locator(".saturday-card")
    .filter({ hasText: pickupName });
  await expect(saturdayCard).toBeVisible();
  await expect(saturdayCard).toContainText("Borrador");

  await saturdayCard
    .getByRole("button", { name: "QR del punto" })
    .click();
  const qrDialog = page.getByRole("dialog");
  await expect(
    qrDialog.getByRole("heading", { name: pickupName }),
  ).toBeVisible();
  await qrDialog
    .getByRole("button", { name: "Cerrar QR" })
    .click();

  await page.goto("/admin/personal");
  await expect(
    page.getByRole("heading", { name: "Personal" }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Personal");

  await page
    .getByRole("button", { name: "Nueva cuenta" })
    .click();

  const staffForm = page.locator(".staff-create-form");
  await staffForm.getByLabel("Nombre").fill(staffName);
  await staffForm.getByLabel("Correo").fill(staffEmail);
  await staffForm
    .getByLabel("Contraseña temporal")
    .fill("Ops-E2E-Staff-2026-Strong!");
  await staffForm
    .getByRole("button", { name: "Crear cuenta" })
    .click();

  await expect(
    page.getByText(`Cuenta creada para ${staffName}.`),
  ).toBeVisible();

  let staffCard = page
    .locator(".staff-card")
    .filter({ hasText: staffEmail });
  await expect(staffCard).toBeVisible();

  await staffCard
    .locator(".staff-role-control select")
    .selectOption("DELIVERY");
  await expect(
    page.getByText(`Rol de ${staffName} actualizado.`),
  ).toBeVisible();

  staffCard = page
    .locator(".staff-card")
    .filter({ hasText: staffEmail });
  await staffCard
    .getByRole("button", { name: "Desactivar" })
    .click();
  await expect(
    page.getByText(`${staffName} fue desactivado.`),
  ).toBeVisible();

  await page.goto("/admin/arco");
  await expect(
    page.getByRole("heading", { name: "Solicitudes ARCO" }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "ARCO");

  const arcoCard = page
    .locator(".arco-admin-card")
    .filter({ hasText: arco.folio });

  await expect(arcoCard).toBeVisible();
  await expect(arcoCard).toContainText(arcoName);

  await arcoCard
    .getByRole("button", { name: "Verificar identidad" })
    .click();
  await expect(
    page.getByText("Identidad marcada como verificada."),
  ).toBeVisible();

  const updatedArcoCard = page
    .locator(".arco-admin-card")
    .filter({ hasText: arco.folio });
  await updatedArcoCard
    .getByLabel("Nota interna")
    .fill("Identidad validada en prueba E2E.");
  await updatedArcoCard
    .getByRole("button", { name: "Resolver" })
    .click();

  await expect(
    page.getByText("Solicitud marcada como resuelta."),
  ).toBeVisible();
  await expect(
    page
      .locator(".arco-admin-card")
      .filter({ hasText: arco.folio }),
  ).toContainText("Resuelta");

  await page.goto("/admin/cocina");
  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/dashboard",
  );

  await page.goto("/admin/entrega");
  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/dashboard",
  );
});
