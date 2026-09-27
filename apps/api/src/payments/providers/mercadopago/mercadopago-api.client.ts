import { Injectable } from "@nestjs/common";
import type {
  MercadoPagoCreateOrderInput,
  MercadoPagoOrderResponse,
} from "./mercadopago.types.js";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 10_000;

function requireAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();

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

function assertCreateOrderResponse(
  payload: unknown,
): asserts payload is MercadoPagoOrderResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Mercado Pago create order returned an invalid response",
    );
  }

  const record = payload as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.status !== "string" ||
    typeof record.checkout_url !== "string" ||
    typeof record.total_amount !== "string"
  ) {
    throw new Error(
      "Mercado Pago create order returned an invalid response",
    );
  }
}

@Injectable()
export class MercadoPagoApiClient {
  async createOrder(
    input: MercadoPagoCreateOrderInput,
  ): Promise<MercadoPagoOrderResponse> {
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

    assertCreateOrderResponse(payload);

    return payload;
  }
}
