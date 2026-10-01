import { expect, test } from "@playwright/test";
import { assertNoBlockingA11y } from "./accessibility-assertions";

test("Axe cubre Home y Login público en CI", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Arma tu pedido." }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Home");

  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await assertNoBlockingA11y(page, "Login");
});
