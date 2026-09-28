import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const MAX_STRIPE_SIGNATURE_HEADER = 2_048;
const MAX_MERCADOPAGO_SIGNATURE_HEADER = 1_024;
const MAX_MERCADOPAGO_REQUEST_ID = 128;
const MAX_MERCADOPAGO_DATA_ID = 128;

function safeEqualHex(expectedHex: string, receivedHex: string) {
  if (
    !/^[a-f0-9]+$/i.test(expectedHex) ||
    !/^[a-f0-9]+$/i.test(receivedHex)
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");

  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

function parseSignatureHeader(header: string) {
  return header.split(",").reduce<Record<string, string[]>>((result, pair) => {
    const separator = pair.indexOf("=");

    if (separator <= 0) return result;

    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();

    if (!key || !value) return result;

    result[key] = [...(result[key] ?? []), value];
    return result;
  }, {});
}

function assertRecentTimestamp(rawTimestamp: string) {
  const numeric = Number(rawTimestamp);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new BadRequestException("Webhook timestamp inválido.");
  }

  const timestampMs = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const ageMs = Math.abs(Date.now() - timestampMs);

  if (ageMs > WEBHOOK_TOLERANCE_SECONDS * 1000) {
    throw new UnauthorizedException("Webhook expirado.");
  }
}

@Injectable()
export class WebhookSecurityService {
  verifyStripe(rawBody: Buffer, signatureHeader: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    if (!secret) {
      throw new UnauthorizedException(
        "Stripe webhook signing secret no configurado.",
      );
    }

    if (!signatureHeader) {
      throw new UnauthorizedException("Falta Stripe-Signature.");
    }

    if (signatureHeader.length > MAX_STRIPE_SIGNATURE_HEADER) {
      throw new BadRequestException(
        "Stripe-Signature demasiado largo.",
      );
    }

    const parts = parseSignatureHeader(signatureHeader);
    const timestamp = parts.t?.[0];
    const signatures = parts.v1 ?? [];

    if (!timestamp || signatures.length === 0) {
      throw new UnauthorizedException("Firma Stripe inválida.");
    }

    assertRecentTimestamp(timestamp);

    const signedPayload = Buffer.concat([
      Buffer.from(timestamp + ".", "utf8"),
      rawBody,
    ]);

    const expected = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    if (!signatures.some((signature) => safeEqualHex(expected, signature))) {
      throw new UnauthorizedException("Firma Stripe inválida.");
    }

    return true;
  }

  verifyMercadoPago(input: {
    signatureHeader: string | undefined;
    requestId: string | undefined;
    dataId: string | undefined;
  }) {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();

    if (!secret) {
      throw new UnauthorizedException(
        "Mercado Pago webhook signing secret no configurado.",
      );
    }

    if (!input.signatureHeader || !input.requestId || !input.dataId) {
      throw new UnauthorizedException(
        "Faltan datos de firma de Mercado Pago.",
      );
    }

    if (
      input.signatureHeader.length >
        MAX_MERCADOPAGO_SIGNATURE_HEADER ||
      input.requestId.length > MAX_MERCADOPAGO_REQUEST_ID ||
      input.dataId.length > MAX_MERCADOPAGO_DATA_ID
    ) {
      throw new BadRequestException(
        "Datos de firma de Mercado Pago demasiado largos.",
      );
    }

    const parts = parseSignatureHeader(input.signatureHeader);
    const timestamp = parts.ts?.[0];
    const signatures = parts.v1 ?? [];

    if (!timestamp || signatures.length === 0) {
      throw new UnauthorizedException("Firma Mercado Pago inválida.");
    }

    assertRecentTimestamp(timestamp);

    const manifest =
      "id:" +
      input.dataId.toLowerCase() +
      ";request-id:" +
      input.requestId +
      ";ts:" +
      timestamp +
      ";";

    const expected = createHmac("sha256", secret)
      .update(manifest, "utf8")
      .digest("hex");

    if (!signatures.some((signature) => safeEqualHex(expected, signature))) {
      throw new UnauthorizedException("Firma Mercado Pago inválida.");
    }

    return true;
  }
}
