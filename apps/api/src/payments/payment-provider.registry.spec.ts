import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import type { MercadoPagoApiClient } from "./providers/mercadopago/mercadopago-api.client.js";
import { MercadoPagoProvider } from "./providers/mercadopago/mercadopago.provider.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function mercadoPagoProvider() {
  return new MercadoPagoProvider({
    createOrder: vi.fn(),
  } as unknown as MercadoPagoApiClient);
}

function registry() {
  return new PaymentProviderRegistry(
    new MockPaymentProvider(),
    mercadoPagoProvider(),
  );
}

describe("PaymentProviderRegistry", () => {
  it("resuelve el proveedor mock registrado", () => {
    const mock = new MockPaymentProvider();
    const mercadoPago = mercadoPagoProvider();
    const paymentProviders = new PaymentProviderRegistry(
      mock,
      mercadoPago,
    );

    expect(paymentProviders.get("mock")).toBe(mock);
    expect(paymentProviders.get("mercadopago")).toBe(mercadoPago);
  });

  it("usa mock por defecto fuera de producción", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "");

    const mock = new MockPaymentProvider();
    const paymentProviders = new PaymentProviderRegistry(
      mock,
      mercadoPagoProvider(),
    );

    expect(paymentProviders.getConfigured()).toBe(mock);
  });

  it("rechaza proveedores desconocidos", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "otro");

    const paymentProviders = registry();

    expect(() => paymentProviders.getConfigured()).toThrow(
      "Unsupported PAYMENT_PROVIDER: otro",
    );
  });

  it("resuelve mercadopago cuando está configurado", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "mercadopago");

    expect(registry().getConfigured().name).toBe("mercadopago");
  });

  it("rechaza stripe mientras todavía no esté registrado", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");

    expect(() => registry().getConfigured()).toThrow(
      'Payment provider "stripe" is not registered yet',
    );
  });

  it("no hace fallback a mock en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "");

    const paymentProviders = registry();

    expect(() => paymentProviders.getConfigured()).toThrow(
      "PAYMENT_PROVIDER is required in production",
    );
  });
});
