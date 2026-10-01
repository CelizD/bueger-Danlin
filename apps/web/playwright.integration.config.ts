import { defineConfig, devices } from "@playwright/test";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for integrated E2E tests`);
  }

  return value;
}

const databaseUrl = requiredEnv("DATABASE_URL");
const mfaEncryptionKey = requiredEnv("MFA_ENCRYPTION_KEY");

export default defineConfig({
  testDir: "./e2e/integration",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3101",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-integrated",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --dir ../api exec nest start",
      url: "http://localhost:4000/api/v1/health/ready",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        API_PORT: "4000",
        APP_ORIGIN: "http://localhost:3101",
        QR_TOKEN_SECRET:
          process.env.QR_TOKEN_SECRET ??
          "integrated-e2e-qr-secret-not-for-production-123456789",
        AUTH_JWT_SECRET:
          process.env.AUTH_JWT_SECRET ??
          "integrated-e2e-auth-secret-not-for-production-123456789",
        MFA_ENCRYPTION_KEY: mfaEncryptionKey,
        PAYMENT_PROVIDER: "mock",
        ENABLE_REAL_PAYMENTS: "false",
        APP_TIMEZONE: "America/Tijuana",
      },
    },
    {
      command: "pnpm exec next dev -p 3101",
      url: "http://localhost:3101",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
      },
    },
  ],
});
