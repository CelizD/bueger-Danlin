import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import type { PurchaseEmailService } from "../notifications/purchase-email.service.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import type { MercadoPagoApiClient } from "./providers/mercadopago/mercadopago-api.client.js";
import { MercadoPagoProvider } from "./providers/mercadopago/mercadopago.provider.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";
import { PaymentsService } from "./payments.service.js";

const TOKEN = "order-token-valid-for-payment-tests";
const TOKEN_HASH = createHash("sha256")
  .update(TOKEN)
  .digest("hex");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderCode: "H-A1B2C3D4",
    verificationTokenHash: TOKEN_HASH,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    reservationExpiresAt: new Date(Date.now() + 15 * 60_000),
    totalCents: 13000,
    currency: "MXN",
    pickupEvent: {
      id: "event-1",
      status: "OPEN",
      closesAt: new Date(Date.now() + 60 * 60_000),
      groupDeliveryFinalizedAt: null,
    },
    customer: {
      name: "Cliente de prueba",
      email: "cliente@example.com",
      phone: "+526641234567",
    },
    ...overrides,
  };
}

function harness(
  snapshot: ReturnType<typeof order> | null,
  lockedOrder: ReturnType<typeof order> | null = snapshot,
) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(
      lockedOrder ? [{ id: lockedOrder.id }] : [],
    ),
    order: {
      findUnique: vi.fn().mockResolvedValue(lockedOrder),
      update: vi.fn().mockResolvedValue(undefined),
    },
    payment: {
      upsert: vi.fn().mockResolvedValue({
        id: "payment-mock-1",
        orderId: "order-1",
        provider: "MOCK",
        status: "PAID",
        amountCents: 13000,
        currency: "MXN",
      }),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    emailNotification: {
      upsert: vi.fn().mockResolvedValue({
        id: "email-1",
        orderId: "order-1",
        type: "PURCHASE_CONFIRMATION",
        recipient: "cliente@example.com",
        status: "PENDING",
      }),
    },
  };

  const prisma = {
    order: {
      findUnique: vi.fn().mockResolvedValue(snapshot),
    },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    ),
  } as unknown as PrismaService;

  const inventory = {
    commitOrder: vi.fn().mockResolvedValue(undefined),
  } as unknown as InventoryService;

  const mockPaymentProvider = new MockPaymentProvider();
  const paymentProviderRegistry = new PaymentProviderRegistry(
    mockPaymentProvider,
    new MercadoPagoProvider({
      createOrder: vi.fn(),
    } as unknown as MercadoPagoApiClient),
  );
  const createCheckoutSpy = vi.spyOn(
    mockPaymentProvider,
    "createCheckout",
  );

  const groupTelegram = {
    observeCompleted: vi.fn().mockResolvedValue(undefined),
  } as unknown as GroupTelegramNotificationService;

  const purchaseEmail = {
    trySendForOrder: vi.fn().mockResolvedValue({
      sent: true,
    }),
  } as unknown as PurchaseEmailService;

  return {
    service: new PaymentsService(
      prisma,
      inventory,
      paymentProviderRegistry,
      undefined,
      groupTelegram,
      purchaseEmail,
    ),
    prisma,
    inventory,
    mockPaymentProvider,
    createCheckoutSpy,
    groupTelegram,
    purchaseEmail,
    tx,
  };
}

const originalNodeEnv = process.env.NODE_ENV;
const originalPaymentProvider = process.env.PAYMENT_PROVIDER;
const originalEnableRealPayments = process.env.ENABLE_REAL_PAYMENTS;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalPaymentProvider === undefined) {
    delete process.env.PAYMENT_PROVIDER;
  } else {
    process.env.PAYMENT_PROVIDER = originalPaymentProvider;
  }

  if (originalEnableRealPayments === undefined) {
    delete process.env.ENABLE_REAL_PAYMENTS;
  } else {
    process.env.ENABLE_REAL_PAYMENTS = originalEnableRealPayments;
  }
});

describe("PaymentsService", () => {
  it("oculta el endpoint mock en producción antes de tocar la base", async () => {
    process.env.NODE_ENV = "production";
    const { service, prisma } = harness(order());

    await expect(
      service.confirmMockPayment("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("rechaza un token de pedido inválido", async () => {
    process.env.NODE_ENV = "test";
    const { service } = harness(order());

    await expect(
      service.confirmMockPayment(
        "H-A1B2C3D4",
        "token-equivocado",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("es idempotente cuando el pedido ya está pagado", async () => {
    process.env.NODE_ENV = "test";
    const paidOrder = order({
      status: "PAID",
      paymentStatus: "PAID",
      reservationExpiresAt: null,
    });
    const {
      service,
      tx,
      inventory,
      createCheckoutSpy,
    } = harness(paidOrder, paidOrder);

    const result = await service.confirmMockPayment(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(result).toMatchObject({
      orderCode: "H-A1B2C3D4",
      status: "PAID",
      paymentStatus: "PAID",
      paid: true,
    });
    expect(createCheckoutSpy).not.toHaveBeenCalled();
    expect(tx.payment.upsert).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(inventory.commitOrder).not.toHaveBeenCalled();
  });

  it("rechaza el pago cuando el punto de entrega ya cerró", async () => {
    process.env.NODE_ENV = "test";
    const closed = order({
      pickupEvent: {
        id: "event-1",
        status: "CLOSED",
        closesAt: new Date(Date.now() - 1_000),
        groupDeliveryFinalizedAt: new Date(),
      },
    });
    const {
      service,
      tx,
      inventory,
      createCheckoutSpy,
    } = harness(closed, closed);

    await expect(
      service.confirmMockPayment("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(createCheckoutSpy).not.toHaveBeenCalled();
    expect(tx.payment.upsert).not.toHaveBeenCalled();
    expect(inventory.commitOrder).not.toHaveBeenCalled();
  });

  it("rechaza el pago cuando la reserva ya expiró", async () => {
    process.env.NODE_ENV = "test";
    const expired = order({
      reservationExpiresAt: new Date(Date.now() - 1_000),
    });
    const {
      service,
      tx,
      inventory,
      createCheckoutSpy,
    } = harness(expired, expired);

    await expect(
      service.confirmMockPayment("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(createCheckoutSpy).not.toHaveBeenCalled();
    expect(tx.payment.upsert).not.toHaveBeenCalled();
    expect(inventory.commitOrder).not.toHaveBeenCalled();
  });

  it("confirma una sola vez el pago, la orden y el inventario", async () => {
    process.env.NODE_ENV = "test";
    const pending = order();
    const {
      service,
      tx,
      inventory,
      createCheckoutSpy,
      groupTelegram,
      purchaseEmail,
    } = harness(pending, pending);

    const result = await service.confirmMockPayment(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(createCheckoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "order-1",
        orderCode: "H-A1B2C3D4",
        amountCents: 13000,
        currency: "MXN",
        idempotencyKey: "mock:order-1",
      }),
    );
    expect(tx.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { idempotencyKey: "mock:order-1" },
        create: expect.objectContaining({
          externalId: "LOCAL-order-1",
        }),
      }),
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1" },
        data: expect.objectContaining({
          status: "PAID",
          paymentStatus: "PAID",
          reservationExpiresAt: null,
        }),
      }),
    );
    expect(inventory.commitOrder).toHaveBeenCalledWith(
      tx,
      "order-1",
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "PAYMENT_CONFIRMED",
        entityType: "Payment",
        entityId: "payment-mock-1",
        before: {
          orderStatus: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
        },
        after: {
          orderId: "order-1",
          provider: "MOCK",
          status: "PAID",
          amountCents: 13000,
          currency: "MXN",
          orderStatus: "PAID",
          paymentStatus: "PAID",
        },
      },
    });
    expect(groupTelegram.observeCompleted).toHaveBeenCalledWith(
      "event-1",
    );
    expect(
      tx.emailNotification.upsert,
    ).toHaveBeenCalledWith({
      where: {
        orderId_type: {
          orderId: "order-1",
          type: "PURCHASE_CONFIRMATION",
        },
      },
      update: {
        recipient: "cliente@example.com",
      },
      create: {
        orderId: "order-1",
        type: "PURCHASE_CONFIRMATION",
        recipient: "cliente@example.com",
        status: "PENDING",
      },
    });
    expect(
      purchaseEmail.trySendForOrder,
    ).toHaveBeenCalledWith("order-1");
    expect(result).toMatchObject({
      status: "PAID",
      paymentStatus: "PAID",
      totalCents: 13000,
      currency: "MXN",
      paid: true,
    });
  });
});


function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-1",
    orderId: "order-1",
    provider: "MERCADOPAGO",
    status: "PENDING",
    amountCents: 13000,
    currency: "MXN",
    externalId: null,
    idempotencyKey: "mercadopago:order-1",
    metadata: {
      checkoutState: "PENDING",
    },
    paidAt: null,
    refundedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function checkoutHarness(options?: {
  existingPayment?: ReturnType<typeof payment> | null;
  createOrderError?: Error;
}) {
  const pendingOrder = order();
  const createdPayment = payment();
  let transactionOpen = false;

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([
      { id: pendingOrder.id },
    ]),
    order: {
      findUnique: vi.fn().mockResolvedValue(pendingOrder),
    },
    payment: {
      findUnique: vi.fn().mockResolvedValue(
        options?.existingPayment ?? null,
      ),
      create: vi.fn().mockResolvedValue(createdPayment),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };

  const updatedPayment = {
    ...createdPayment,
    externalId: "ORDTST01",
    metadata: {
      checkoutState: "CREATED",
      checkoutUrl:
        "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
    },
  };

  const prisma = {
    order: {
      findUnique: vi.fn().mockResolvedValue(pendingOrder),
    },
    payment: {
      update: vi.fn().mockResolvedValue(updatedPayment),
    },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) => {
        transactionOpen = true;

        try {
          return await callback(tx);
        } finally {
          transactionOpen = false;
        }
      },
    ),
  } as unknown as PrismaService;

  const inventory = {
    commitOrder: vi.fn().mockResolvedValue(undefined),
  } as unknown as InventoryService;

  const createOrder = vi.fn().mockImplementation(async () => {
    expect(transactionOpen).toBe(false);

    if (options?.createOrderError) {
      throw options.createOrderError;
    }

    return {
      id: "ORDTST01",
      status: "created",
      status_detail: "created",
      checkout_url:
        "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
      total_amount: "130.00",
      external_reference: "H-A1B2C3D4",
    };
  });

  const mercadoPagoProvider = new MercadoPagoProvider({
    createOrder,
  } as unknown as MercadoPagoApiClient);

  const registry = new PaymentProviderRegistry(
    new MockPaymentProvider(),
    mercadoPagoProvider,
  );

  return {
    service: new PaymentsService(prisma, inventory, registry),
    prisma,
    inventory,
    tx,
    createOrder,
    createdPayment,
  };
}

describe("PaymentsService.createCheckout", () => {
  it("bloquea pagos reales antes de crear Payment cuando el kill switch está apagado", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mercadopago";
    process.env.ENABLE_REAL_PAYMENTS = "false";

    const { service, prisma, tx, createOrder } = checkoutHarness();

    await expect(
      service.createCheckout("H-A1B2C3D4", TOKEN),
    ).rejects.toThrow("Real payment calls are disabled");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rechaza checkout real cuando el punto ya cerró", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mercadopago";
    process.env.ENABLE_REAL_PAYMENTS = "true";

    const { service, tx, createOrder } = checkoutHarness();
    tx.order.findUnique.mockResolvedValue({
      ...order(),
      pickupEvent: {
        id: "event-1",
        status: "CLOSED",
        closesAt: new Date(Date.now() - 1_000),
        groupDeliveryFinalizedAt: new Date(),
      },
    });

    await expect(
      service.createCheckout("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("crea Payment PENDING antes de llamar a Mercado Pago y no marca la orden como pagada", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mercadopago";
    process.env.ENABLE_REAL_PAYMENTS = "true";

    const {
      service,
      prisma,
      tx,
      createOrder,
    } = checkoutHarness();

    const result = await service.createCheckout(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        provider: "MERCADOPAGO",
        status: "PENDING",
        amountCents: 13000,
        currency: "MXN",
        idempotencyKey: "mercadopago:order-1",
      }),
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "PAYMENT_CHECKOUT_CREATED",
        entityType: "Payment",
        entityId: "payment-1",
        after: {
          orderId: "order-1",
          provider: "MERCADOPAGO",
          status: "PENDING",
          amountCents: 13000,
          currency: "MXN",
        },
      },
    });

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        externalId: "ORDTST01",
        status: "PENDING",
      }),
    });

    expect(result).toMatchObject({
      orderCode: "H-A1B2C3D4",
      orderStatus: "PENDING_PAYMENT",
      paymentId: "payment-1",
      paymentStatus: "PENDING",
      provider: "mercadopago",
      checkoutUrl:
        "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
    });
  });

  it("reutiliza el checkout persistido sin crear otra orden externa", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mercadopago";
    process.env.ENABLE_REAL_PAYMENTS = "true";

    const existingPayment = payment({
      externalId: "ORDTST01",
      metadata: {
        checkoutState: "CREATED",
        checkoutUrl:
          "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=ORDTST01",
      },
    });

    const {
      service,
      prisma,
      tx,
      createOrder,
    } = checkoutHarness({ existingPayment });

    const result = await service.createCheckout(
      "H-A1B2C3D4",
      TOKEN,
    );

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(result.checkoutUrl).toContain("ORDTST01");
  });

  it("deja el Payment PENDING si Mercado Pago falla para poder reintentar con la misma idempotency key", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mercadopago";
    process.env.ENABLE_REAL_PAYMENTS = "true";

    const {
      service,
      prisma,
      tx,
    } = checkoutHarness({
      createOrderError: new Error("Mercado Pago unavailable"),
    });

    await expect(
      service.createCheckout("H-A1B2C3D4", TOKEN),
    ).rejects.toThrow("Mercado Pago unavailable");

    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("rechaza el checkout real cuando el proveedor configurado es mock", async () => {
    process.env.NODE_ENV = "test";
    process.env.PAYMENT_PROVIDER = "mock";

    const { service } = checkoutHarness();

    await expect(
      service.createCheckout("H-A1B2C3D4", TOKEN),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
