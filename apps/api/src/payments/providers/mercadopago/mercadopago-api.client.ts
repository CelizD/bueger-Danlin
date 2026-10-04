import { Injectable } from "@nestjs/common";
import { assertRealPaymentsEnabled } from "../../real-payments.guard.js";
import { readSetting } from "../../../config/secret-setting.js";
import type {
  MercadoPagoCreateOrderInput,
  MercadoPagoOrderResponse,
  MercadoPagoRefundOrderInput,
  MercadoPagoRefundOrderResponse,
} from "./mercadopago.types.js";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 10_000;

export class MercadoPagoApiError extends Error {
  constructor(
    operation: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(
      `Mercado Pago ${operation} failed (${status}${
        code ? `: ${code}` : ""
      })`,
    );
  }
}

function requireAccessToken() {
  const token = readSetting("MERCADOPAGO_ACCESS_TOKEN");

  if (!token) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN is required to call Mercado Pago",
    );
  }

  return token;
}

function assertIdempotencyKey(idempotencyKey: string) {
  const length = idempotencyKey.length;

  if (length < 1 || length > 128) {
    throw new Error(
      "Mercado Pago idempotency key must contain between 1 and 128 characters",
    );
  }
}

function assertOrderId(externalId: string) {
  const id = externalId.trim();

  if (!id || id.length > 128) {
    throw new Error("Mercado Pago order id is invalid");
  }

  return id;
}

function errorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.code === "string") {
    return record.code;
  }

  if (typeof record.error === "string") {
    return record.error;
  }

  return undefined;
}

function assertOrderResponse(
  payload: unknown,
): asserts payload is MercadoPagoOrderResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Mercado Pago order API returned an invalid response",
    );
  }

  const record = payload as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.status !== "string" ||
    typeof record.total_amount !== "string"
  ) {
    throw new Error(
      "Mercado Pago order API returned an invalid response",
    );
  }
}

function assertRefundOrderResponse(
  payload: unknown,
): asserts payload is MercadoPagoRefundOrderResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Mercado Pago refund API returned an invalid response",
    );
  }

  const record = payload as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.status !== "string"
  ) {
    throw new Error(
      "Mercado Pago refund API returned an invalid response",
    );
  }
}

@Injectable()
export class MercadoPagoApiClient {
  async createOrder(
    input: MercadoPagoCreateOrderInput,
  ): Promise<MercadoPagoOrderResponse> {
    assertRealPaymentsEnabled();

    const accessToken = requireAccessToken();

    assertIdempotencyKey(input.idempotencyKey);

    const response = await fetch(
      `${MERCADO_PAGO_API_BASE_URL}/v1/orders`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
          "x-idempotency-key": input.idempotencyKey,
        },
        body: JSON.stringify(input.body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      const code = errorCode(payload);
      const suffix = code ? `: ${code}` : "";

      throw new Error(
        `Mercado Pago create order failed (${response.status}${suffix})`,
      );
    }

    assertOrderResponse(payload);

    if (typeof payload.checkout_url !== "string") {
      throw new Error(
        "Mercado Pago create order returned no checkout URL",
      );
    }

    return payload;
  }

  async getOrder(externalId: string): Promise<MercadoPagoOrderResponse> {
    assertRealPaymentsEnabled();

    const accessToken = requireAccessToken();
    const id = assertOrderId(externalId);

    const response = await fetch(
      `${MERCADO_PAGO_API_BASE_URL}/v1/orders/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      const code = errorCode(payload);
      const suffix = code ? `: ${code}` : "";

      throw new Error(
        `Mercado Pago get order failed (${response.status}${suffix})`,
      );
    }

    assertOrderResponse(payload);
    return payload;
  }

  async refundOrder(
    input: MercadoPagoRefundOrderInput,
  ): Promise<MercadoPagoRefundOrderResponse> {
    assertRealPaymentsEnabled();

    const accessToken = requireAccessToken();
    const id = assertOrderId(input.orderId);

    assertIdempotencyKey(input.idempotencyKey);

    const response = await fetch(
      `${MERCADO_PAGO_API_BASE_URL}/v1/orders/${encodeURIComponent(id)}/refund`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
          "x-idempotency-key": input.idempotencyKey,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new MercadoPagoApiError(
        "refund order",
        response.status,
        errorCode(payload),
      );
    }

    assertRefundOrderResponse(payload);
    return payload;
  }
}
