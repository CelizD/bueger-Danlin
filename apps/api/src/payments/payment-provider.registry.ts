import { Injectable } from "@nestjs/common";
import type { PaymentProvider } from "./domain/payment-provider.interface.js";
import type { PaymentProviderName } from "./domain/payment-provider.types.js";
import { MercadoPagoProvider } from "./providers/mercadopago/mercadopago.provider.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";

const providerNames = new Set<PaymentProviderName>([
  "mock",
  "mercadopago",
  "stripe",
]);

function parseProviderName(
  value: string | undefined,
): PaymentProviderName | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (!providerNames.has(normalized as PaymentProviderName)) {
    throw new Error(
      `Unsupported PAYMENT_PROVIDER: ${normalized}`,
    );
  }

  return normalized as PaymentProviderName;
}

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<PaymentProviderName, PaymentProvider>;

  constructor(
    mockPaymentProvider: MockPaymentProvider,
    mercadoPagoProvider: MercadoPagoProvider,
  ) {
    this.providers = new Map<PaymentProviderName, PaymentProvider>([
      [mockPaymentProvider.name, mockPaymentProvider],
      [mercadoPagoProvider.name, mercadoPagoProvider],
    ]);
  }

  get(name: PaymentProviderName): PaymentProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(
        `Payment provider "${name}" is not registered yet`,
      );
    }

    return provider;
  }

  getConfigured(): PaymentProvider {
    const configured = parseProviderName(
      process.env.PAYMENT_PROVIDER,
    );

    if (configured) {
      return this.get(configured);
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PAYMENT_PROVIDER is required in production",
      );
    }

    return this.get("mock");
  }
}
