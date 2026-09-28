import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MercadoPagoApiClient } from "./mercadopago-api.client.js";

beforeEach(() => {
  vi.stubEnv("ENABLE_REAL_PAYMENTS", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function orderInput() {
  return {
    idempotencyKey: "mp-order-1",
    body: {
      type: "online" as const,
      processing_mode: "manual" as const,
      capture_mode: "automatic_async" as const,
      total_amount: "130.00",
      external_reference: "H-A1B2C3D4",
      description: "Pedido H-A1B2C3D4 - Burger Danlin",
      payer: {
        email: "cliente@example.com",
      },
    },
  };
}

describe("MercadoPagoApiClient", () => {
  it("no hace tráfico aunque exista token si los pagos reales están deshabilitados", async () => {
    vi.stubEnv("ENABLE_REAL_PAYMENTS", "false");
    vi.stubEnv(
      "MERCADOPAGO_ACCESS_TOKEN",
      "APP_USR-test-access-token-long-enough",
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new MercadoPagoApiClient().createOrder(orderInput()),
    ).rejects.toThrow("Real payment calls are disabled");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("crea una order usando auth e idempotencia", async () => {
    vi.stubEnv(
      "MERCADOPAGO_ACCESS_TOKEN",
      "APP_USR-test-access-token-long-enough",
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ORDTST01",
          status: "created",
          status_detail: "created",
          checkout_url:
            "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
          total_amount: "130.00",
          external_reference: "H-A1B2C3D4",
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MercadoPagoApiClient().createOrder(
      orderInput(),
    );

    expect(result).toMatchObject({
      id: "ORDTST01",
      status: "created",
      total_amount: "130.00",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];

    expect(url).toBe("https://api.mercadopago.com/v1/orders");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      authorization:
        "Bearer APP_USR-test-access-token-long-enough",
      "x-idempotency-key": "mp-order-1",
      "content-type": "application/json",
    });
    expect(JSON.parse(options.body as string)).toMatchObject({
      type: "online",
      processing_mode: "manual",
      total_amount: "130.00",
      external_reference: "H-A1B2C3D4",
    });
  });

  it("consulta una order por ID para reconciliar webhooks", async () => {
    vi.stubEnv(
      "MERCADOPAGO_ACCESS_TOKEN",
      "APP_USR-test-access-token-long-enough",
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ORDTST01",
          status: "processed",
          status_detail: "accredited",
          total_amount: "130.00",
          total_paid_amount: "130.00",
          external_reference: "H-A1B2C3D4",
          last_updated_date: "2026-09-28T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result =
      await new MercadoPagoApiClient().getOrder("ORDTST01");

    expect(result).toMatchObject({
      id: "ORDTST01",
      status: "processed",
      total_amount: "130.00",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://api.mercadopago.com/v1/orders/ORDTST01",
    );
    expect(options.method).toBe("GET");
    expect(options.headers).toMatchObject({
      authorization:
        "Bearer APP_USR-test-access-token-long-enough",
    });
  });

  it("no llama la API si falta el access token", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new MercadoPagoApiClient().createOrder(orderInput()),
    ).rejects.toThrow(
      "MERCADOPAGO_ACCESS_TOKEN is required to call Mercado Pago",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza llaves de idempotencia mayores a 128 caracteres", async () => {
    vi.stubEnv(
      "MERCADOPAGO_ACCESS_TOKEN",
      "APP_USR-test-access-token-long-enough",
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new MercadoPagoApiClient().createOrder({
        ...orderInput(),
        idempotencyKey: "x".repeat(129),
      }),
    ).rejects.toThrow(
      "Mercado Pago idempotency key must contain between 1 and 128 characters",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expone un error sanitizado de Mercado Pago", async () => {
    vi.stubEnv(
      "MERCADOPAGO_ACCESS_TOKEN",
      "APP_USR-test-access-token-long-enough",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "invalid_total_amount",
            message: "invalid amount",
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(
      new MercadoPagoApiClient().createOrder(orderInput()),
    ).rejects.toThrow(
      "Mercado Pago create order failed (400: invalid_total_amount)",
    );
  });

  it("rechaza respuestas exitosas con formato inválido", async () => {
    vi.stubEnv(
      "MERCADOPAGO_ACCESS_TOKEN",
      "APP_USR-test-access-token-long-enough",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "ORDTST01",
            status: "created",
          }),
          {
            status: 201,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    );

    await expect(
      new MercadoPagoApiClient().createOrder(orderInput()),
    ).rejects.toThrow(
      "Mercado Pago order API returned an invalid response",
    );
  });
});
