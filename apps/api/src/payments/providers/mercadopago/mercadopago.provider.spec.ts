import { describe, expect, it } from "vitest";
import { MercadoPagoProvider } from "./mercadopago.provider.js";

describe("MercadoPagoProvider", () => {
  it("se identifica como mercadopago", () => {
    expect(new MercadoPagoProvider().name).toBe("mercadopago");
  });

  it("falla de forma explícita mientras no exista integración real", async () => {
    const provider = new MercadoPagoProvider();

    await expect(
      provider.createCheckout({
        paymentId: "payment-1",
        orderCode: "H-A1B2C3D4",
        amountCents: 13000,
        currency: "MXN",
        description: "Pedido de prueba",
        idempotencyKey: "mercadopago:payment-1",
        customer: {
          name: "Cliente de prueba",
        },
      }),
    ).rejects.toThrow(
      "Mercado Pago provider is registered but not connected yet",
    );
  });
});
