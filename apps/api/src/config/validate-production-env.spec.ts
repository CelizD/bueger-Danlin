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

  it("acepta Stripe con secretos configurados", () => {
    expect(() => validateProductionEnvironment()).not.toThrow();
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
