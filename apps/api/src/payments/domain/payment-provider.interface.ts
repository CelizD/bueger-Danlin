import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  GetPaymentResult,
  PaymentProviderName,
  RefundPaymentInput,
  RefundPaymentResult,
} from "./payment-provider.types.js";

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult>;

  getPayment(
    externalId: string,
  ): Promise<GetPaymentResult>;

  refund(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult>;
}
