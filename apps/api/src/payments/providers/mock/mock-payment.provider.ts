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
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  private readonly payments = new Map<string, GetPaymentResult>();
  private readonly checkoutsByIdempotencyKey = new Map<
    string,
    CreateCheckoutResult
  >();
  private readonly refundsByIdempotencyKey = new Map<
    string,
    RefundPaymentResult
  >();
  private readonly refundedAmountByExternalId = new Map<string, number>();

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const existing = this.checkoutsByIdempotencyKey.get(
      input.idempotencyKey,
    );

    if (existing) {
      return { ...existing };
    }

    const externalId = `LOCAL-${input.paymentId}`;
    const paidAt = new Date();

    this.payments.set(externalId, {
      externalId,
      status: "PAID",
      amountCents: input.amountCents,
      currency: input.currency,
      paidAt,
    });

    const result: CreateCheckoutResult = {
      externalId,
      status: "PAID",
    };

    this.checkoutsByIdempotencyKey.set(input.idempotencyKey, result);

    return { ...result };
  }

  async getPayment(externalId: string): Promise<GetPaymentResult> {
    const payment = this.payments.get(externalId);

    if (!payment) {
      throw new Error("Mock payment not found");
    }

    return { ...payment };
  }

  async refund(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    const existing = this.refundsByIdempotencyKey.get(
      input.idempotencyKey,
    );

    if (existing) {
      return { ...existing };
    }

    const payment = await this.getPayment(input.externalId);
    const refunded =
      this.refundedAmountByExternalId.get(input.externalId) ?? 0;
    const remaining = payment.amountCents - refunded;
    const amount = input.amountCents ?? remaining;

    if (amount <= 0 || amount > remaining) {
      throw new Error("Invalid mock refund amount");
    }

    const totalRefunded = refunded + amount;
    const status =
      totalRefunded === payment.amountCents
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED";

    this.refundedAmountByExternalId.set(
      input.externalId,
      totalRefunded,
    );
    this.payments.set(input.externalId, {
      ...payment,
      status,
    });

    const result: RefundPaymentResult = {
      externalId: input.externalId,
      status,
      refundedAmountCents: amount,
    };

    this.refundsByIdempotencyKey.set(input.idempotencyKey, result);

    return { ...result };
  }
}
