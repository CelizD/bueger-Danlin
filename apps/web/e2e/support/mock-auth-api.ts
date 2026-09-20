import type { Page, Route } from "@playwright/test";

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-request-id",
};

async function json(
  route: Route,
  body: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

export async function mockAdminLoginWithMfa(page: Page) {
  await page.route("**/api/v1/auth/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
      });
      return;
    }

    if (path.endsWith("/auth/me") && method === "GET") {
      await json(
        route,
        {
          message: "No autenticado",
        },
        401,
      );
      return;
    }

    if (path.endsWith("/auth/login") && method === "POST") {
      await json(route, {
        mfaRequired: true,
        setupRequired: false,
      });
      return;
    }

    await json(
      route,
      {
        message: `E2E auth mock sin respuesta para ${method} ${path}`,
      },
      404,
    );
  });
}

export async function mockAdminLoginFailure(page: Page) {
  await page.route("**/api/v1/auth/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: corsHeaders,
      });
      return;
    }

    if (path.endsWith("/auth/me") && method === "GET") {
      await json(route, { message: "No autenticado" }, 401);
      return;
    }

    if (path.endsWith("/auth/login") && method === "POST") {
      await json(
        route,
        { message: "Credenciales inválidas." },
        401,
      );
      return;
    }

    await json(route, { message: "No encontrado" }, 404);
  });
}
