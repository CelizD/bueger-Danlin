const weakValues = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "secret",
  "password",
  "burger_local",
]);

function requireStrongSecret(name: string, minLength: number) {
  const value = process.env[name]?.trim() ?? "";

  if (value.length < minLength || weakValues.has(value.toLowerCase())) {
    throw new Error(
      `${name} must be a strong secret with at least ${minLength} characters`,
    );
  }

  return value;
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const appOrigins =
    process.env.APP_ORIGIN
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  if (
    appOrigins.length === 0 ||
    appOrigins.some((origin) => !origin.startsWith("https://"))
  ) {
    throw new Error(
      "APP_ORIGIN is required in production and every origin must use HTTPS",
    );
  }

  const authSecret = requireStrongSecret("AUTH_JWT_SECRET", 48);
  const qrSecret = requireStrongSecret("QR_TOKEN_SECRET", 48);

  if (authSecret === qrSecret) {
    throw new Error("AUTH_JWT_SECRET and QR_TOKEN_SECRET must be different");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl || databaseUrl.includes("burger_local")) {
    throw new Error(
      "DATABASE_URL must be configured with production credentials",
    );
  }

  const provider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();

  if (provider === "stripe") {
    requireStrongSecret("STRIPE_SECRET_KEY", 24);
    requireStrongSecret("STRIPE_WEBHOOK_SECRET", 24);
  }

  if (provider === "mercadopago") {
    requireStrongSecret("MERCADOPAGO_ACCESS_TOKEN", 24);
    requireStrongSecret("MERCADOPAGO_WEBHOOK_SECRET", 24);
  }
}
