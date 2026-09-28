import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import type { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import type { PaymentProviderRegistry } from "./payment-provider.registry.js";
import {
  PaymentWebhookService,
  shouldApplyPaymentStatus,
} from "./payment-webhook.service.js";
import type { WebhookSecurityService } from "./webhook-security.service.js";

const BODY = {
  action: "order.processed",
  date_created: "2026-09-28T00:00:00.000Z",
  type: "order",
  data: {
    id: "ORD-1",
    status: "processed",
  },
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const EVENT_ID =
  "fp:" +
  hash(
    [
      "order",
      "order.processed",
      "2026-09-28T00:00:00.000Z",
      "ORD-1",
    ].join("|"),
  );

const REPLAY_KEY = hash(
  ["ts=1,v1=abc", "request-1", "ORD-1"].join("|"),
);

function harness(options?: {
  eventStatus?:
    | "RECEIVED"
    | "PROCESSING"
    | "PROCESSED"
    | "IGNORED"
    | "FAILED";
  duplicate?: boolean;
  paymentStatus?:
    | "PENDING"
    | "PROCESSING"
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED";
  canonicalStatus?:
    | "PENDING"
    | "PROCESSING"
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED";
  canonicalAmountCents?: number;
  knownPayment?: boolean;
  eventUpdatedAt?: Date;
}) {
  const event = {
    id: "webhook-1",
    eventId: EVENT_ID,
    replayKey: REPLAY_KEY,
    resourceId: "ORD-1",
    type: "order",
    bodyHash: hash(JSON.stringify(BODY)),
    status: options?.eventStatus ?? "RECEIVED",
    updatedAt: options?.eventUpdatedAt ?? new Date(),
  };

  const createEvent = vi.fn();
  if (options?.duplicate) {
    createEvent.mockRejectedValue({ code: "P2002" });
  } else {
    createEvent.mockResolvedValue(event);
  }

  const currentStatus = options?.paymentStatus ?? "PENDING";
  const canonicalStatus = options?.canonicalStatus ?? "PAID";

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "payment-1" }]),
    payment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "payment-1",
        status: currentStatus,
        amountCents: 13_000,
        currency: "MXN",
        provider: "MERCADOPAGO",
        order: {
          id: "order-1",
          orderCode: "H-A1B2C3D4",
          status: "PENDING_PAYMENT",
          paymentStatus: currentStatus,
          totalCents: 13_000,
          currency: "MXN",
          comboQuantity: 1,
          reservationExpiresAt: new Date(),
          pickupEvent: {
            id: "event-1",
            locationLabel: "Universidad",
          },
        },
      }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    order: {
      update: vi.fn().mockResolvedValue(undefined),
    },
    orderStatusHistory: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
    paymentWebhookEvent: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  };

  const prisma = {
    paymentWebhookEvent: {
      create: createEvent,
      findFirst: vi.fn().mockResolvedValue(event),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    payment: {
      findFirst: vi.fn().mockResolvedValue(
        options?.knownPayment === false
          ? null
          : { id: "payment-1" },
      ),
    },
    $transaction: vi.fn(
      async (callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
    ),
  } as unknown as PrismaService;

  const getPayment = vi.fn().mockResolvedValue({
    externalId: "ORD-1",
    status: canonicalStatus,
    amountCents: options?.canonicalAmountCents ?? 13_000,
    currency: "MXN",
    paidAt: new Date(),
  });

  const providers = {
    get: vi.fn().mockReturnValue({
      getPayment,
    }),
  } as unknown as PaymentProviderRegistry;

  const security = {
    verifyMercadoPago: vi.fn().mockReturnValue(true),
  } as unknown as WebhookSecurityService;

  const inventory = {
    commitOrder: vi.fn().mockResolvedValue(undefined),
    releaseOrder: vi.fn().mockResolvedValue(undefined),
  } as unknown as InventoryService;

  const telegram = {
    notifyPaymentConfirmed: vi.fn(),
  } as unknown as TelegramNotificationService;

  const groupTelegram = {
    observeCompleted: vi.fn().mockResolvedValue(undefined),
  } as unknown as GroupTelegramNotificationService;

  const service = new PaymentWebhookService(
    prisma,
    inventory,
    providers,
    security,
    telegram,
    groupTelegram,
  );

  return {
    service,
    prisma,
    tx,
    security,
    providers,
    getPayment,
    inventory,
    telegram,
    groupTelegram,
    createEvent,
  };
}

function input() {
  return {
    body: BODY,
    signatureHeader: "ts=1,v1=abc",
    requestId: "request-1",
    dataId: "ORD-1",
    queryType: "order",
  };
}

describe("shouldApplyPaymentStatus", () => {
  it("no permite degradar un pago ya pagado", () => {
    expect(
      shouldApplyPaymentStatus("PAID", "PENDING"),
    ).toBe(false);
    expect(
      shouldApplyPaymentStatus("PAID", "FAILED"),
    ).toBe(false);
    expect(
      shouldApplyPaymentStatus("PAID", "CANCELLED"),
    ).toBe(false);
  });

  it("permite avanzar de processing a paid y de paid a refunded", () => {
    expect(
      shouldApplyPaymentStatus("PROCESSING", "PAID"),
    ).toBe(true);
    expect(
      shouldApplyPaymentStatus("PAID", "REFUNDED"),
    ).toBe(true);
  });
});

describe("PaymentWebhookService", () => {
  it("deduplica una notificación ya procesada sin consultar al proveedor", async () => {
    const h = harness({
      duplicate: true,
      eventStatus: "PROCESSED",
    });

    const result = await h.service.handleMercadoPago(input());

    expect(result).toMatchObject({
      accepted: true,
      duplicate: true,
      eventId: EVENT_ID,
      status: "PROCESSED",
    });
    expect(h.getPayment).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("recupera un PROCESSING abandonado por un worker caído", async () => {
    const h = harness({
      duplicate: true,
      eventStatus: "PROCESSING",
      eventUpdatedAt: new Date(Date.now() - 5 * 60_000),
    });

    const result = await h.service.handleMercadoPago(input());

    expect(
      h.prisma.paymentWebhookEvent.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "webhook-1",
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: "PROCESSING",
            }),
          ]),
        }),
      }),
    );
    expect(result).toMatchObject({
      accepted: true,
      duplicate: false,
      applied: true,
      paymentStatus: "PAID",
    });
  });

  it("rechaza replay con los mismos datos firmados pero body alterado", async () => {
    const h = harness({
      duplicate: true,
      eventStatus: "PROCESSED",
    });

    await expect(
      h.service.handleMercadoPago({
        ...input(),
        body: {
          ...BODY,
          action: "order.cancelled",
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(h.getPayment).not.toHaveBeenCalled();
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reintenta un evento que había fallado", async () => {
    const h = harness({
      duplicate: true,
      eventStatus: "FAILED",
    });

    const result = await h.service.handleMercadoPago(input());

    expect(
      h.prisma.paymentWebhookEvent.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "webhook-1",
          OR: expect.arrayContaining([
            {
              status: {
                in: ["RECEIVED", "FAILED"],
              },
            },
          ]),
        }),
      }),
    );
    expect(result).toMatchObject({
      accepted: true,
      duplicate: false,
      applied: true,
      paymentStatus: "PAID",
    });
  });

  it("confirma el pago una sola vez usando el estado canónico", async () => {
    const h = harness();

    const result = await h.service.handleMercadoPago(input());

    expect(h.security.verifyMercadoPago).toHaveBeenCalledWith({
      signatureHeader: "ts=1,v1=abc",
      requestId: "request-1",
      dataId: "ORD-1",
    });
    expect(h.getPayment).toHaveBeenCalledWith("ORD-1");
    expect(h.tx.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        status: "PAID",
      }),
    });
    expect(h.inventory.commitOrder).toHaveBeenCalledWith(
      h.tx,
      "order-1",
    );
    expect(h.tx.orderStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(h.telegram.notifyPaymentConfirmed).toHaveBeenCalledTimes(1);
    expect(h.groupTelegram.observeCompleted).toHaveBeenCalledWith(
      "event-1",
    );
    expect(result).toMatchObject({
      accepted: true,
      duplicate: false,
      applied: true,
      paymentStatus: "PAID",
    });
  });

  it("ignora un evento fuera de orden que intentaría degradar PAID", async () => {
    const h = harness({
      paymentStatus: "PAID",
      canonicalStatus: "PROCESSING",
    });

    const result = await h.service.handleMercadoPago(input());

    expect(h.tx.payment.update).not.toHaveBeenCalled();
    expect(h.tx.order.update).not.toHaveBeenCalled();
    expect(h.inventory.commitOrder).not.toHaveBeenCalled();
    expect(h.tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: "PAYMENT_WEBHOOK_IGNORED",
        entityType: "Payment",
        entityId: "payment-1",
        before: { status: "PAID" },
        after: {
          incomingStatus: "PROCESSING",
          reason: "NON_FORWARD_TRANSITION",
        },
      },
    });
    expect(result).toMatchObject({
      applied: false,
      paymentStatus: "PAID",
    });
  });

  it("rechaza monto distinto y deja el evento en FAILED para reintento/investigación", async () => {
    const h = harness({
      canonicalAmountCents: 12_000,
    });

    await expect(
      h.service.handleMercadoPago(input()),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      h.prisma.paymentWebhookEvent.update,
    ).toHaveBeenCalledWith({
      where: { id: "webhook-1" },
      data: {
        status: "FAILED",
        lastError: expect.stringContaining("Monto o moneda"),
      },
    });
  });

  it("rechaza si query data.id y body.data.id no coinciden", async () => {
    const h = harness();

    await expect(
      h.service.handleMercadoPago({
        ...input(),
        body: {
          ...BODY,
          data: { id: "ORD-DIFFERENT" },
        },
      }),
    ).rejects.toThrow("El recurso del webhook no coincide.");

    expect(h.getPayment).not.toHaveBeenCalled();
    expect(h.prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("falla y permite reintento si el recurso todavía no está asociado localmente", async () => {
    const h = harness({
      knownPayment: false,
    });

    await expect(
      h.service.handleMercadoPago(input()),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      h.prisma.paymentWebhookEvent.update,
    ).toHaveBeenCalledWith({
      where: { id: "webhook-1" },
      data: {
        status: "FAILED",
        lastError: expect.any(String),
      },
    });
  });
});
