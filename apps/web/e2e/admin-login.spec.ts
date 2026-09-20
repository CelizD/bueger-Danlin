import { expect, test } from "@playwright/test";
import {
  mockAdminLoginFailure,
  mockAdminLoginWithMfa,
} from "./support/mock-auth-api";

test("login de personal avanza al segundo factor MFA", async ({
  page,
}) => {
  await mockAdminLoginWithMfa(page);
  await page.goto("/admin/login");

  await expect(
    page.getByRole("heading", {
      name: "Iniciar sesión",
    }),
  ).toBeVisible();

  await page.getByLabel("Correo").fill("admin@example.com");
  await page.getByLabel("Contraseña").fill("CorrectHorseBatteryStaple!");

  await page
    .getByRole("button", {
      name: "Entrar al panel",
    })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Verifica tu identidad",
    }),
  ).toBeVisible();

  await expect(
    page.getByLabel("Código MFA o recuperación"),
  ).toBeVisible();
});

test("login anuncia credenciales inválidas", async ({
  page,
}) => {
  await mockAdminLoginFailure(page);
  await page.goto("/admin/login");

  await page.getByLabel("Correo").fill("admin@example.com");
  await page.getByLabel("Contraseña").fill("incorrecta");

  await page
    .getByRole("button", {
      name: "Entrar al panel",
    })
    .click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Credenciales inválidas.");
});
