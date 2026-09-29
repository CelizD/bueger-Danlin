import { Injectable } from "@nestjs/common";
import type { PaymentProvider } from "../../domain/payment-provider.interface.js";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  GetPaymentResult,
  ProviderPaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
} from "../../domain/payment-provider.types.js";
import {
  MercadoPagoApiClient,
  MercadoPagoApiError,
} from "./mercadopago-api.client.js";
import type {
  MercadoPagoOrderResponse,
  MercadoPagoRefundOrderResponse,
} from "./mercadopago.types.js";

function formatAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Payment amount must be a positive integer in cents");
  }

  return (amountCents / 100).toFixed(2);
}

function expirationDuration(expiresAt: Date | null | undefined) {
  if (!expiresAt) {
    return undefined;
  }

  const remainingSeconds = Math.ceil(
    (expiresAt.getTime() - Date.now()) / 1000,
  );

  if (remainingSeconds <= 0) {
    throw new Error("Payment reservation has already expired");
  }

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  let value = "PT";

  if (hours > 0) value += `${hours}H`;
  if (minutes > 0) value += `${minutes}M`;
  if (seconds > 0 || value === "PT") value += `${seconds}S`;

  return value;
}

function mapOrderStatus(
  order: Pick<
    MercadoPagoOrderResponse | MercadoPagoRefundOrderResponse,
    "status" | "status_detail"
  >,
): ProviderPaymentStatus {
  switch (order.status) {
    case "created":
    case "action_required":
      return "PENDING";
    case "processing":
      return "PROCESSING";
    case "processed":
      if (order.status_detail === "partially_refunded") {
        return "PARTIALLY_REFUNDED";
      }

      if (order.status_detail === "refunded") {
        return "REFUNDED";
      }

      return "PAID";
    case "refunded":
      return "REFUNDED";
    case "failed":
      return "FAILED";
    case "canceled":
    case "expired":
      return "CANCELLED";
    default:
      throw new Error(
        `Unsupported Mercado Pago order status: ${order.status}`,
      );
  }
}

function isRefundReconciliationError(error: unknown) {
  return (
    error instanceof MercadoPagoApiError &&
    [
      "order_already_refunded",
      "order_refund_already_in_process",
      "idempotency_key_already_used",
    ].includes(error.code ?? "")
  );
}

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;

  constructor(
    private readonly apiClient: MercadoPagoApiClient,
  ) {}

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    if (input.currency.toUpperCase() !== "MXN") {
      throw new Error(
        "Mercado Pago provider currently supports MXN only",
      );
    }

    const email = input.customer.email?.trim();
    const expirationTime = expirationDuration(input.expiresAt);

    const order = await this.apiClient.createOrder({
      idempotencyKey: input.idempotencyKey,
      body: {
        type: "online",
        processing_mode: "manual",
        capture_mode: "automatic_async",
        total_amount: formatAmount(input.amountCents),
        external_reference: input.orderCode,
        description: input.description,
        ...(expirationTime
          ? { expiration_time: expirationTime }
          : {}),
        ...(email
          ? {
              payer: {
                email,
              },
            }
          : {}),
        ...(input.returnUrls
          ? {
              config: {
                online: {
                  success_url:
                    input.returnUrls.successUrl,
                  failure_url:
                    input.returnUrls.failureUrl,
                  pending_url:
                    input.returnUrls.pendingUrl,
                  auto_return: "all" as const,
                },
              },
            }
          : {}),
      },
    });

    return {
      externalId: order.id,
      status: mapOrderStatus(order),
      checkoutUrl: order.checkout_url,
    };
  }

  async getPayment(
    externalId: string,
  ): Promise<GetPaymentResult> {
    const order = await this.apiClient.getOrder(externalId);
    const amount = Number(order.total_amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        "Mercado Pago returned an invalid order amount",
      );
    }

    const paidAtCandidate =
      order.status === "processed" && order.last_updated_date
        ? new Date(order.last_updated_date)
        : null;
    const paidAt =
      paidAtCandidate &&
      Number.isFinite(paidAtCandidate.getTime())
        ? paidAtCandidate
        : null;

    return {
      externalId: order.id,
      status: mapOrderStatus(order),
      amountCents: Math.round(amount * 100),
      currency: "MXN",
      paidAt,
    };
  }

  async refund(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    if (input.amountCents !== undefined) {
      throw new Error(
        "Mercado Pago partial refunds are not supported by this integration yet",
      );
    }

    const current = await this.getPayment(input.externalId);

    if (current.status === "REFUNDED") {
      return {
        externalId: current.externalId,
        status: "REFUNDED",
        refundedAmountCents: current.amountCents,
      };
    }

    if (current.status !== "PAID") {
      throw new Error(
        `Mercado Pago order is not refundable from status ${current.status}`,
      );
    }

    let refunded:
      | MercadoPagoRefundOrderResponse
      | undefined;

    try {
      refunded = await this.apiClient.refundOrder({
        orderId: input.externalId,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (!isRefundReconciliationError(error)) {
        throw error;
      }

      const reconciled =
        await this.getPayment(input.externalId);

      if (reconciled.status !== "REFUNDED") {
        throw error;
      }

      return {
        externalId: reconciled.externalId,
        status: "REFUNDED",
        refundedAmountCents: reconciled.amountCents,
      };
    }

    const status = mapOrderStatus(refunded);

    if (status !== "REFUNDED") {
      throw new Error(
        `Mercado Pago refund did not reach REFUNDED status: ${status}`,
      );
    }

    return {
      externalId: refunded.id,
      status,
      refundedAmountCents: current.amountCents,
    };
  }
}
