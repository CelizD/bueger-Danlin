export type PaymentProviderName =
  | "mock"
  | "mercadopago"
  | "stripe";

export type ProviderPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export interface PaymentCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface CreateCheckoutInput {
  paymentId: string;
  orderCode: string;
  amountCents: number;
  currency: string;
  description: string;
  idempotencyKey: string;
  expiresAt?: Date | null;
  customer: PaymentCustomerInput;
  returnUrls?: {
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
  };
}

export interface CreateCheckoutResult {
  externalId: string;
  status: ProviderPaymentStatus;
  checkoutUrl?: string;
}

export interface GetPaymentResult {
  externalId: string;
  status: ProviderPaymentStatus;
  amountCents: number;
  currency: string;
  paidAt?: Date | null;
}

export interface RefundPaymentInput {
  externalId: string;
  idempotencyKey: string;
  amountCents?: number;
}

export interface RefundPaymentResult {
  externalId: string;
  status: ProviderPaymentStatus;
  refundedAmountCents: number;
}
