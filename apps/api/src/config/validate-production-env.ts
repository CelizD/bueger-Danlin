import { readFileSync } from "node:fs";

const weakValues = new Set([
  "",
  "change-me",
  "change-me-in-production",
  "secret",
  "password",
  "burger_local",
]);

const productionPaymentProviders = new Set([
  "mercadopago",
]);

function setting(name: string) {
  const direct = process.env[name]?.trim();

  if (direct) return direct;

  const file = process.env[`${name}_FILE`]?.trim();

  if (!file) return "";

  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

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
  const mfaEncryptionKey =
    process.env.MFA_ENCRYPTION_KEY?.trim() ?? "";

  let decodedMfaKey: Buffer;

  try {
    decodedMfaKey = Buffer.from(
      mfaEncryptionKey,
      "base64url",
    );
  } catch {
    decodedMfaKey = Buffer.alloc(0);
  }

  if (decodedMfaKey.length !== 32) {
    throw new Error(
      "MFA_ENCRYPTION_KEY must be a base64url-encoded 32-byte key",
    );
  }

  if (authSecret === qrSecret) {
    throw new Error("AUTH_JWT_SECRET and QR_TOKEN_SECRET must be different");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl || databaseUrl.includes("burger_local")) {
    throw new Error(
      "DATABASE_URL must be configured with production credentials",
    );
  }

  const telegramSetting =
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED
      ?.trim()
      .toLowerCase() || "false";

  if (!["true", "false"].includes(telegramSetting)) {
    throw new Error(
      "TELEGRAM_NOTIFICATIONS_ENABLED must be either true or false in production",
    );
  }

  if (telegramSetting === "true") {
    const telegramBotToken = setting("TELEGRAM_BOT_TOKEN");

    if (
      telegramBotToken.length < 20 ||
      weakValues.has(telegramBotToken.toLowerCase())
    ) {
      throw new Error(
        "TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN_FILE must provide a valid bot token",
      );
    }

    const telegramChatId = setting("TELEGRAM_CHAT_ID");

    if (!/^-?\d+$/.test(telegramChatId)) {
      throw new Error(
        "TELEGRAM_CHAT_ID must be a numeric Telegram chat ID",
      );
    }
  }

  const provider =
    process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? "";
  const realPaymentsSetting =
    process.env.ENABLE_REAL_PAYMENTS?.trim().toLowerCase() || "false";

  if (!["true", "false"].includes(realPaymentsSetting)) {
    throw new Error(
      "ENABLE_REAL_PAYMENTS must be either true or false in production",
    );
  }

  const realPaymentsEnabled = realPaymentsSetting === "true";

  if (!productionPaymentProviders.has(provider)) {
    throw new Error(
      "PAYMENT_PROVIDER must be mercadopago in production",
    );
  }

  if (realPaymentsEnabled && provider === "mercadopago") {
    requireStrongSecret("MERCADOPAGO_ACCESS_TOKEN", 24);
    requireStrongSecret("MERCADOPAGO_WEBHOOK_SECRET", 24);
  }
}
