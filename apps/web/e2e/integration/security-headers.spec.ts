import { expect, test } from "@playwright/test";

test("CSP usa nonce por request y no permite scripts unsafe-inline", async ({
  request,
}) => {
  const response = await request.get("/");

  expect(response.ok()).toBe(true);

  const policy = response.headers()["content-security-policy"];
  expect(policy).toBeTruthy();

  const scriptDirective =
    policy
      ?.split("; ")
      .find((entry) => entry.startsWith("script-src ")) ?? "";

  expect(scriptDirective).toContain("'nonce-");
  expect(scriptDirective).toContain("'strict-dynamic'");
  expect(scriptDirective).not.toContain("'unsafe-inline'");

  const nonce = scriptDirective.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();

  const html = await response.text();
  expect(html).toContain(`nonce="${nonce}"`);
});
