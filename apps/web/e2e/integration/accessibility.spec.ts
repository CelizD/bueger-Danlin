import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

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

function totpAtOffset(secret: string, offset: number) {
  const step =
    Math.floor(Date.now() / 1000 / 30) + offset;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counter)
    .digest();
  const digestOffset =
    digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[digestOffset]! & 0x7f) << 24) |
    ((digest[digestOffset + 1]! & 0xff) << 16) |
    ((digest[digestOffset + 2]! & 0xff) << 8) |
    (digest[digestOffset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

async function assertNoBlockingA11y(
  page: import("@playwright/test").Page,
  label: string,
) {
  const results = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
    ])
    .analyze();

  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" ||
      violation.impact === "critical",
  );

  expect(
    blocking,
    `${label} accessibility violations:\n${JSON.stringify(
      blocking,
      null,
      2,
    )}`,
  ).toEqual([]);
}

async function loginAccessibilityAdmin(
  page: import("@playwright/test").Page,
  retry: number,
) {
  await page.goto("/admin/login");

  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Login");

  await page
    .getByLabel("Correo")
    .fill("a11y-admin.e2e@example.test");
  await page
    .getByLabel("Contraseña")
    .fill(requiredEnv("E2E_A11Y_ADMIN_PASSWORD"));
  await page
    .getByRole("button", { name: "Entrar al panel" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Verifica tu identidad",
    }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "MFA verification");

  await page
    .getByLabel("Código MFA o recuperación")
    .fill(
      totpAtOffset(
        requiredEnv("E2E_A11Y_ADMIN_MFA_SECRET"),
        retry,
      ),
    );
  await page
    .getByRole("button", { name: "Verificar y entrar" })
    .click();

  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/dashboard",
  );
}

test("Axe cubre home y paneles operativos reales", async (
  { page },
  testInfo,
) => {
  test.setTimeout(180_000);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Arma tu pedido." }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Home");

  await loginAccessibilityAdmin(page, testInfo.retry);

  const adminPages = [
    {
      path: "/admin/dashboard",
      heading: "Panel del día",
      label: "Dashboard",
    },
    {
      path: "/admin/pedidos",
      heading: "Pedidos",
      label: "Pedidos",
    },
    {
      path: "/admin/inventario",
      heading: "Inventario",
      label: "Inventario",
    },
    {
      path: "/admin/sabados",
      heading: "Sábados",
      label: "Sábados",
    },
    {
      path: "/admin/personal",
      heading: "Personal",
      label: "Personal",
    },
    {
      path: "/admin/arco",
      heading: "Solicitudes ARCO",
      label: "ARCO",
    },
  ] as const;

  for (const target of adminPages) {
    await page.goto(target.path);
    await expect(
      page.getByRole("heading", {
        name: target.heading,
        level: 1,
      }),
    ).toBeVisible();
    await assertNoBlockingA11y(page, target.label);
  }

  await page.goto("/admin/cocina");
  await expect(
    page.getByRole("heading", {
      name: "Cocina",
      level: 1,
    }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Cocina");

  await page.goto("/admin/entrega");
  await expect(
    page.getByRole("heading", {
      name: "Entrega",
      level: 1,
    }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Entrega");
});
