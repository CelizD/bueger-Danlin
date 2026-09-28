import {
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { WebhookSecurityService } from "./webhook-security.service.js";

const NOW = new Date("2026-09-20T16:00:00.000Z");

describe("WebhookSecurityService", () => {
  const service = new WebhookSecurityService();
  const originalStripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalMercadoPagoSecret =
    process.env.MERCADOPAGO_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.STRIPE_WEBHOOK_SECRET =
      "whsec_test_signing_secret";
    process.env.MERCADOPAGO_WEBHOOK_SECRET =
      "mp_test_signing_secret";
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalStripeSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET =
        originalStripeSecret;
    }

    if (originalMercadoPagoSecret === undefined) {
      delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    } else {
      process.env.MERCADOPAGO_WEBHOOK_SECRET =
        originalMercadoPagoSecret;
    }
  });

  it("acepta una firma Stripe válida dentro de la ventana de tolerancia", () => {
    const rawBody = Buffer.from(
      JSON.stringify({ id: "evt_test" }),
      "utf8",
    );
    const timestamp = Math.floor(NOW.getTime() / 1000).toString();
    const signature = createHmac(
      "sha256",
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
      .update(
        Buffer.concat([
          Buffer.from(timestamp + ".", "utf8"),
          rawBody,
        ]),
      )
      .digest("hex");

    expect(
      service.verifyStripe(
        rawBody,
        `t=${timestamp},v1=deadbeef,v1=${signature}`,
      ),
    ).toBe(true);
  });

  it("rechaza una firma Stripe inválida", () => {
    const rawBody = Buffer.from("{}", "utf8");
    const timestamp = Math.floor(NOW.getTime() / 1000).toString();

    expect(() =>
      service.verifyStripe(
        rawBody,
        `t=${timestamp},v1=${"0".repeat(64)}`,
      ),
    ).toThrow(UnauthorizedException);
  });

  it("rechaza un webhook Stripe expirado", () => {
    const rawBody = Buffer.from("{}", "utf8");
    const timestamp = Math.floor(
      (NOW.getTime() - 6 * 60_000) / 1000,
    ).toString();
    const signature = createHmac(
      "sha256",
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
      .update(
        Buffer.concat([
          Buffer.from(timestamp + ".", "utf8"),
          rawBody,
        ]),
      )
      .digest("hex");

    expect(() =>
      service.verifyStripe(
        rawBody,
        `t=${timestamp},v1=${signature}`,
      ),
    ).toThrow(UnauthorizedException);
  });

  it("rechaza timestamps Stripe malformados", () => {
    expect(() =>
      service.verifyStripe(
        Buffer.from("{}"),
        `t=no-es-fecha,v1=${"0".repeat(64)}`,
      ),
    ).toThrow(BadRequestException);
  });

  it("acepta una firma Mercado Pago válida", () => {
    const timestamp = Math.floor(NOW.getTime() / 1000).toString();
    const requestId = "request-123";
    const dataId = "PAYMENT-ABC";
    const manifest =
      `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac(
      "sha256",
      process.env.MERCADOPAGO_WEBHOOK_SECRET!,
    )
      .update(manifest, "utf8")
      .digest("hex");

    expect(
      service.verifyMercadoPago({
        signatureHeader: `ts=${timestamp},v1=${signature}`,
        requestId,
        dataId,
      }),
    ).toBe(true);
  });

  it("rechaza headers de firma Stripe demasiado largos", () => {
    expect(() =>
      service.verifyStripe(
        Buffer.from("{}"),
        "x".repeat(2_049),
      ),
    ).toThrow(BadRequestException);
  });

  it("rechaza headers o IDs de Mercado Pago demasiado largos", () => {
    expect(() =>
      service.verifyMercadoPago({
        signatureHeader: "x".repeat(1_025),
        requestId: "request-123",
        dataId: "payment-123",
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.verifyMercadoPago({
        signatureHeader: "ts=1,v1=abc",
        requestId: "r".repeat(129),
        dataId: "payment-123",
      }),
    ).toThrow(BadRequestException);
  });

  it("rechaza Mercado Pago cuando faltan datos de firma", () => {
    expect(() =>
      service.verifyMercadoPago({
        signatureHeader: undefined,
        requestId: "request-123",
        dataId: "payment-123",
      }),
    ).toThrow(UnauthorizedException);
  });
});
