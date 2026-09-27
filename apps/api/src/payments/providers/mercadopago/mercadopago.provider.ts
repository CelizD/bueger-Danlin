import { Injectable } from "@nestjs/common";
import type { PaymentProvider } from "../../domain/payment-provider.interface.js";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  GetPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
} from "../../domain/payment-provider.types.js";

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;

  async createCheckout(
    _input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    throw new Error(
      "Mercado Pago provider is registered but not connected yet",
    );
  }

  async getPayment(
    _externalId: string,
  ): Promise<GetPaymentResult> {
    throw new Error(
      "Mercado Pago provider is registered but not connected yet",
    );
  }

  async refund(
    _input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    throw new Error(
      "Mercado Pago provider is registered but not connected yet",
    );
  }
}
