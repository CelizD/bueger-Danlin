import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PaymentProviderRegistry", () => {
  it("resuelve el proveedor mock registrado", () => {
    const mock = new MockPaymentProvider();
    const registry = new PaymentProviderRegistry(mock);

    expect(registry.get("mock")).toBe(mock);
  });

  it("usa mock por defecto fuera de producción", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "");

    const mock = new MockPaymentProvider();
    const registry = new PaymentProviderRegistry(mock);

    expect(registry.getConfigured()).toBe(mock);
  });

  it("rechaza proveedores desconocidos", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYMENT_PROVIDER", "otro");

    const registry = new PaymentProviderRegistry(
      new MockPaymentProvider(),
    );

    expect(() => registry.getConfigured()).toThrow(
      "Unsupported PAYMENT_PROVIDER: otro",
    );
  });

  it.each(["mercadopago", "stripe"] as const)(
    "rechaza %s mientras todavía no esté registrado",
    (provider) => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("PAYMENT_PROVIDER", provider);

      const registry = new PaymentProviderRegistry(
        new MockPaymentProvider(),
      );

      expect(() => registry.getConfigured()).toThrow(
        `Payment provider "${provider}" is not registered yet`,
      );
    },
  );

  it("no hace fallback a mock en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "");

    const registry = new PaymentProviderRegistry(
      new MockPaymentProvider(),
    );

    expect(() => registry.getConfigured()).toThrow(
      "PAYMENT_PROVIDER is required in production",
    );
  });
});
