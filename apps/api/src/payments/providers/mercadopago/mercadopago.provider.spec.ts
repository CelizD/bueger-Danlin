import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { MercadoPagoApiClient } from "./mercadopago-api.client.js";
import { MercadoPagoProvider } from "./mercadopago.provider.js";

afterEach(() => {
  vi.useRealTimers();
});

function harness() {
  const createOrder = vi.fn().mockResolvedValue({
    id: "ORDTST01",
    status: "created",
    status_detail: "created",
    checkout_url:
      "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
    total_amount: "130.00",
    external_reference: "H-A1B2C3D4",
  });

  const getOrder = vi.fn().mockResolvedValue({
    id: "ORDTST01",
    status: "processed",
    status_detail: "accredited",
    total_amount: "130.00",
    total_paid_amount: "130.00",
    external_reference: "H-A1B2C3D4",
    last_updated_date: "2026-09-28T00:00:00.000Z",
  });

  const refundOrder = vi.fn().mockResolvedValue({
    id: "ORDTST01",
    status: "refunded",
    status_detail: "refunded",
    transactions: {
      refunds: [
        {
          id: "REF01",
          transaction_id: "PAY01",
          amount: "130.00",
          status: "processed",
        },
      ],
    },
  });

  const apiClient = {
    createOrder,
    getOrder,
    refundOrder,
  } as unknown as MercadoPagoApiClient;

  return {
    provider: new MercadoPagoProvider(apiClient),
    createOrder,
    getOrder,
    refundOrder,
  };
}

function checkoutInput() {
  return {
    paymentId: "payment-1",
    orderCode: "H-A1B2C3D4",
    amountCents: 13000,
    currency: "MXN",
    description: "Pedido H-A1B2C3D4 - Burger Danlin",
    idempotencyKey: "mercadopago:payment-1",
    expiresAt: new Date(Date.now() + 15 * 60_000),
    customer: {
      name: "Cliente de prueba",
      email: "cliente@example.com",
      phone: "+526641234567",
    },
  };
}

describe("MercadoPagoProvider", () => {
  it("crea un checkout usando Orders API", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T04:00:00.000Z"));

    const { provider, createOrder } = harness();

    const result = await provider.createCheckout(checkoutInput());

    expect(createOrder).toHaveBeenCalledWith({
      idempotencyKey: "mercadopago:payment-1",
      body: {
        type: "online",
        processing_mode: "manual",
        capture_mode: "automatic_async",
        total_amount: "130.00",
        external_reference: "H-A1B2C3D4",
        description: "Pedido H-A1B2C3D4 - Burger Danlin",
        expiration_time: "PT15M",
        payer: {
          email: "cliente@example.com",
        },
      },
    });

    expect(result).toEqual({
      externalId: "ORDTST01",
      status: "PENDING",
      checkoutUrl:
        "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
    });
  });

  it("omite payer cuando el cliente no tiene email", async () => {
    const { provider, createOrder } = harness();

    await provider.createCheckout({
      ...checkoutInput(),
      expiresAt: null,
      customer: {
        name: "Cliente sin email",
        email: null,
      },
    });

    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.objectContaining({
          payer: expect.anything(),
        }),
      }),
    );
  });

  it("rechaza monedas distintas de MXN", async () => {
    const { provider, createOrder } = harness();

    await expect(
      provider.createCheckout({
        ...checkoutInput(),
        currency: "USD",
      }),
    ).rejects.toThrow(
      "Mercado Pago provider currently supports MXN only",
    );

    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rechaza una reserva expirada antes de llamar Mercado Pago", async () => {
    const { provider, createOrder } = harness();

    await expect(
      provider.createCheckout({
        ...checkoutInput(),
        expiresAt: new Date(Date.now() - 1_000),
      }),
    ).rejects.toThrow(
      "Payment reservation has already expired",
    );

    expect(createOrder).not.toHaveBeenCalled();
  });

  it("consulta el estado canónico de una order", async () => {
    const { provider, getOrder } = harness();

    await expect(
      provider.getPayment("ORDTST01"),
    ).resolves.toEqual({
      externalId: "ORDTST01",
      status: "PAID",
      amountCents: 13000,
      currency: "MXN",
      paidAt: new Date("2026-09-28T00:00:00.000Z"),
    });

    expect(getOrder).toHaveBeenCalledWith("ORDTST01");
  });

  it("reembolsa completamente una order pagada", async () => {
    const { provider, refundOrder } = harness();

    await expect(
      provider.refund({
        externalId: "ORDTST01",
        idempotencyKey: "refund-1",
      }),
    ).resolves.toEqual({
      externalId: "ORDTST01",
      status: "REFUNDED",
      refundedAmountCents: 13000,
    });

    expect(refundOrder).toHaveBeenCalledWith({
      orderId: "ORDTST01",
      idempotencyKey: "refund-1",
    });
  });

  it("es idempotente si la order ya está reembolsada", async () => {
    const { provider, getOrder, refundOrder } = harness();

    getOrder.mockResolvedValueOnce({
      id: "ORDTST01",
      status: "refunded",
      status_detail: "refunded",
      total_amount: "130.00",
      total_paid_amount: "130.00",
      external_reference: "H-A1B2C3D4",
      last_updated_date: "2026-09-28T00:00:00.000Z",
    });

    await expect(
      provider.refund({
        externalId: "ORDTST01",
        idempotencyKey: "refund-1",
      }),
    ).resolves.toEqual({
      externalId: "ORDTST01",
      status: "REFUNDED",
      refundedAmountCents: 13000,
    });

    expect(refundOrder).not.toHaveBeenCalled();
  });

  it("rechaza refunds parciales hasta tener transaction id explícito", async () => {
    const { provider, refundOrder } = harness();

    await expect(
      provider.refund({
        externalId: "ORDTST01",
        idempotencyKey: "refund-1",
        amountCents: 6500,
      }),
    ).rejects.toThrow(
      "Mercado Pago partial refunds are not supported by this integration yet",
    );

    expect(refundOrder).not.toHaveBeenCalled();
  });
});
