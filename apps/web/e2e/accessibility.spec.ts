import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockOrderingApi } from "./support/mock-ordering-api";

test.beforeEach(async ({ page }) => {
  await mockOrderingApi(page);
});

test("home no tiene violaciones serias o críticas de accesibilidad", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Arma tu pedido.",
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
    ])
    .analyze();

  const blockingViolations = results.violations.filter(
    (violation) =>
      violation.impact === "serious" ||
      violation.impact === "critical",
  );

  expect(
    blockingViolations,
    JSON.stringify(blockingViolations, null, 2),
  ).toEqual([]);
});
