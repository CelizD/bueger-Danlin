import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function assertNoBlockingA11y(
  page: Page,
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
