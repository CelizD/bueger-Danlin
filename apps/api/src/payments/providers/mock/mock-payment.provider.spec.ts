import { describe, expect, it } from "vitest";
import { MockPaymentProvider } from "./mock-payment.provider.js";

function checkoutInput() {
  return {
    paymentId: "order-1",
    orderCode: "H-A1B2C3D4",
    amountCents: 13000,
    currency: "MXN",
    description: "Pedido H-A1B2C3D4 - Burger Danlin",
    idempotencyKey: "mock:order-1",
    expiresAt: new Date(Date.now() + 15 * 60_000),
    customer: {
      name: "Cliente de prueba",
      email: "cliente@example.com",
      phone: "+526641234567",
    },
  };
}

describe("MockPaymentProvider", () => {
  it("simula un pago aprobado y permite consultarlo", async () => {
    const provider = new MockPaymentProvider();

    const checkout = await provider.createCheckout(checkoutInput());
    const payment = await provider.getPayment(checkout.externalId);

    expect(checkout).toEqual({
      externalId: "LOCAL-order-1",
      status: "PAID",
    });
    expect(payment).toMatchObject({
      externalId: "LOCAL-order-1",
      status: "PAID",
      amountCents: 13000,
      currency: "MXN",
    });
    expect(payment.paidAt).toBeInstanceOf(Date);
  });

  it("reutiliza el resultado para la misma llave de idempotencia", async () => {
    const provider = new MockPaymentProvider();
    const input = checkoutInput();

    const first = await provider.createCheckout(input);
    const second = await provider.createCheckout(input);

    expect(second).toEqual(first);
  });

  it("simula reembolsos parciales y completos", async () => {
    const provider = new MockPaymentProvider();
    const checkout = await provider.createCheckout(checkoutInput());

    const partial = await provider.refund({
      externalId: checkout.externalId,
      idempotencyKey: "refund:partial",
      amountCents: 3000,
    });
    const complete = await provider.refund({
      externalId: checkout.externalId,
      idempotencyKey: "refund:remaining",
    });
    const payment = await provider.getPayment(checkout.externalId);

    expect(partial).toMatchObject({
      status: "PARTIALLY_REFUNDED",
      refundedAmountCents: 3000,
    });
    expect(complete).toMatchObject({
      status: "REFUNDED",
      refundedAmountCents: 10000,
    });
    expect(payment.status).toBe("REFUNDED");
  });
});
