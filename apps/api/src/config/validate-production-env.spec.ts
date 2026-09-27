import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { validateProductionEnvironment } from "./validate-production-env.js";

function setValidProductionEnvironment() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "https://app.example.com");
  vi.stubEnv("AUTH_JWT_SECRET", "A".repeat(48));
  vi.stubEnv("QR_TOKEN_SECRET", "B".repeat(48));
  vi.stubEnv(
    "MFA_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64url"),
  );
  vi.stubEnv(
    "DATABASE_URL",
    "postgresql://runtime:strong-password@postgres:5432/burger_danlin",
  );
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  vi.stubEnv("ENABLE_REAL_PAYMENTS", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "S".repeat(24));
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "W".repeat(24));
}

describe("validateProductionEnvironment", () => {
  beforeEach(() => {
    setValidProductionEnvironment();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("permite desarrollo con PAYMENT_PROVIDER=mock", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PAYMENT_PROVIDER", "mock");

    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it.each(["", "mock", "otro"])(
    "rechaza PAYMENT_PROVIDER=%s en producción",
    (provider) => {
      vi.stubEnv("PAYMENT_PROVIDER", provider);

      expect(() => validateProductionEnvironment()).toThrow(
        "PAYMENT_PROVIDER must be either stripe or mercadopago in production",
      );
    },
  );

  it("acepta Stripe con secretos configurados cuando pagos reales están habilitados", () => {
    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it("permite arrancar producción sin credenciales del proveedor cuando pagos reales están deshabilitados", () => {
    vi.stubEnv("ENABLE_REAL_PAYMENTS", "false");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it("acepta Telegram cuando está habilitado con token y chat ID", () => {
    vi.stubEnv("TELEGRAM_NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv(
      "TELEGRAM_BOT_TOKEN",
      "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    );
    vi.stubEnv("TELEGRAM_CHAT_ID", "-1001234567890");

    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it("rechaza Telegram habilitado sin token", () => {
    vi.stubEnv("TELEGRAM_NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "123456789");

    expect(() => validateProductionEnvironment()).toThrow(
      "TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN_FILE must provide a valid bot token",
    );
  });

  it("rechaza Telegram habilitado con chat ID inválido", () => {
    vi.stubEnv("TELEGRAM_NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv(
      "TELEGRAM_BOT_TOKEN",
      "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    );
    vi.stubEnv("TELEGRAM_CHAT_ID", "mi-chat");

    expect(() => validateProductionEnvironment()).toThrow(
      "TELEGRAM_CHAT_ID must be a numeric Telegram chat ID",
    );
  });

  it("rechaza valores ambiguos para ENABLE_REAL_PAYMENTS en producción", () => {
    vi.stubEnv("ENABLE_REAL_PAYMENTS", "yes");

    expect(() => validateProductionEnvironment()).toThrow(
      "ENABLE_REAL_PAYMENTS must be either true or false in production",
    );
  });

  it("rechaza Stripe sin sus secretos", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    expect(() => validateProductionEnvironment()).toThrow(
      "STRIPE_WEBHOOK_SECRET must be a strong secret",
    );
  });

  it("acepta Mercado Pago con secretos configurados", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mercadopago");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "M".repeat(24));
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "P".repeat(24));

    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  it("rechaza Mercado Pago sin sus secretos", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "mercadopago");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "M".repeat(24));
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "");

    expect(() => validateProductionEnvironment()).toThrow(
      "MERCADOPAGO_WEBHOOK_SECRET must be a strong secret",
    );
  });
});
