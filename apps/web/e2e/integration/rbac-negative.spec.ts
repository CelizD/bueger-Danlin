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

  await expect(page).toHaveURL(
    (url) => url.pathname === expectedPath,
  );
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

const adminReadPaths = [
  "/admin/dashboard",
  "/admin/orders",
  "/admin/inventory",
  "/admin/pickup-events",
  "/admin/staff",
  "/admin/arco",
] as const;

test("sin sesión, los endpoints privados responden 401", async ({
  request,
}) => {
  const privatePaths = [
    "/staff/kitchen/orders",
    "/staff/delivery/orders",
    ...adminReadPaths,
  ];

  for (const path of privatePaths) {
    const response = await request.get(API_URL + path);
    expect(
      response.status(),
      `Expected 401 for unauthenticated GET ${path}`,
    ).toBe(401);
  }
});

test("KITCHEN solo accede a cocina y recibe 403 en Entrega/Admin", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await staffLogin(
    page,
    "kitchen.e2e@example.test",
    requiredEnv("E2E_KITCHEN_PASSWORD"),
    "/admin/cocina",
  );

  expect(
    await apiStatus(page, {
      path: "/staff/kitchen/orders",
    }),
  ).toBe(200);

  expect(
    await apiStatus(page, {
      path: "/staff/delivery/orders",
    }),
  ).toBe(403);

  for (const path of adminReadPaths) {
    expect(
      await apiStatus(page, { path }),
      `Expected KITCHEN to be forbidden from ${path}`,
    ).toBe(403);
  }

  expect(
    await apiStatus(page, {
      method: "POST",
      path: "/staff/delivery/scan",
      body: {
        qrPayload: "BD1:H-00000000:invalid-token",
      },
    }),
  ).toBe(403);

  expect(
    await apiStatus(page, {
      method: "POST",
      path: "/admin/staff",
      body: {
        name: "Intento Cocina",
        email: "blocked-kitchen@example.test",
        role: "DELIVERY",
        password: "Blocked-Kitchen-Staff-2026!",
      },
    }),
  ).toBe(403);

  await page.goto("/admin/entrega");
  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/cocina",
  );

  await page.goto("/admin/inventario");
  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/cocina",
  );

  await context.close();
});

test("DELIVERY solo accede a entrega y recibe 403 en Cocina/Admin", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await staffLogin(
    page,
    "delivery.e2e@example.test",
    requiredEnv("E2E_DELIVERY_PASSWORD"),
    "/admin/entrega",
  );

  expect(
    await apiStatus(page, {
      path: "/staff/delivery/orders",
    }),
  ).toBe(200);

  expect(
    await apiStatus(page, {
      path: "/staff/kitchen/orders",
    }),
  ).toBe(403);

  for (const path of adminReadPaths) {
    expect(
      await apiStatus(page, { path }),
      `Expected DELIVERY to be forbidden from ${path}`,
    ).toBe(403);
  }

  expect(
    await apiStatus(page, {
      method: "PATCH",
      path: "/staff/kitchen/orders/H-00000000/preparing",
    }),
  ).toBe(403);

  expect(
    await apiStatus(page, {
      method: "POST",
      path: "/admin/pickup-events",
      body: {},
    }),
  ).toBe(403);

  await page.goto("/admin/cocina");
  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/entrega",
  );

  await page.goto("/admin/personal");
  await expect(page).toHaveURL(
    (url) => url.pathname === "/admin/entrega",
  );

  await context.close();
});
