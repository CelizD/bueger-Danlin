import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { PurchaseEmailService } from "./purchase-email.service.js";
import type { SmtpMailTransport } from "./smtp-mail.transport.js";

const envKeys = [
  "BUSINESS_LEGAL_NAME",
  "BUSINESS_TRADE_NAME",
  "BUSINESS_RFC",
  "BUSINESS_ADDRESS",
  "SUPPORT_PHONE",
  "SUPPORT_EMAIL",
] as const;

const original = Object.fromEntries(
  envKeys.map((key) => [
    key,
    process.env[key],
  ]),
);

function notification(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id: "email-1",
    orderId: "order-1",
    recipient:
      "cliente@example.com",
    status: "PROCESSING",
    order: {
      id: "order-1",
      orderCode: "H-A1B2C3D4",
      status: "PAID",
      paymentStatus: "PAID",
      currency: "MXN",
      totalCents: 13_000,
      comboQuantity: 1,
      createdAt: new Date(
        "2026-09-29T22:00:00Z",
      ),
      purchaseTermsVersion:
        "2026-09-29-v2",
      purchaseTermsAcceptedAt:
        new Date(
          "2026-09-29T21:55:00Z",
        ),
      groupDeliveryFinalFeeCents:
        null,
      pickupEventId: "event-1",
      pickupEvent: {
        startsAt: new Date(
          "2026-10-02T20:00:00Z",
        ),
        timezone:
          "America/Tijuana",
        transportCostCents:
          10_000,
        freeDeliveryMinPaidCombos:
          5,
        groupDeliveryFinalizedAt:
          null,
        groupDeliveryFinalPaidCombos:
          null,
        groupDeliveryFinalFreeUnlocked:
          null,
        pickupPoint: {
          name: "Universidad",
          address:
            "Entrada principal",
        },
      },
      items: [
        {
          productName:
            "Hamburguesa + papas",
          quantity: 1,
          lineTotalCents:
            13_000,
          modifiers: [],
        },
      ],
      payments: [
        {
          provider:
            "MERCADOPAGO",
          paidAt: new Date(
            "2026-09-29T22:00:00Z",
          ),
          refundedAt: null,
        },
      ],
    },
    ...overrides,
  };
}

function harness(options?: {
  sendError?: Error;
  orderStatus?: string;
  paymentStatus?: string;
}) {
  const record =
    notification();

  record.order.status =
    options?.orderStatus ??
    "PAID";
  record.order.paymentStatus =
    options?.paymentStatus ??
    "PAID";

  const emailNotification = {
    findMany: vi
      .fn()
      .mockResolvedValue([
        { id: "email-1" },
      ]),
    updateMany: vi
      .fn()
      .mockResolvedValue({
        count: 1,
      }),
    findUnique: vi
      .fn()
      .mockResolvedValue(
        record,
      ),
    update: vi
      .fn()
      .mockResolvedValue(
        undefined,
      ),
  };

  const prisma = {
    emailNotification,
    order: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            comboQuantity: 4,
          },
        ]),
    },
    auditLog: {
      create: vi
        .fn()
        .mockResolvedValue(
          undefined,
        ),
    },
  } as unknown as PrismaService;

  const send = vi.fn();

  if (options?.sendError) {
    send.mockRejectedValue(
      options.sendError,
    );
  } else {
    send.mockResolvedValue({
      sent: true,
      disabled: false,
    });
  }

  const mail = {
    isEnabled:
      vi.fn().mockReturnValue(true),
    send,
  } as unknown as SmtpMailTransport;

  return {
    service:
      new PurchaseEmailService(
        prisma,
        mail,
      ),
    prisma,
    emailNotification,
    send,
  };
}

describe(
  "PurchaseEmailService",
  () => {
    beforeEach(() => {
      process.env.BUSINESS_LEGAL_NAME =
        "Vendedor de prueba";
      process.env.BUSINESS_TRADE_NAME =
        "Burger Danlin";
      process.env.BUSINESS_RFC =
        "ABCD010101ABC";
      process.env.BUSINESS_ADDRESS =
        "Domicilio comercial 123";
      process.env.SUPPORT_PHONE =
        "+52 664 123 4567";
      process.env.SUPPORT_EMAIL =
        "soporte@example.com";
    });

    afterEach(() => {
      for (
        const key of envKeys
      ) {
        const value =
          original[key];

        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] =
            value;
        }
      }
    });

    it("envía y marca SENT con comprobante PDF", async () => {
      const h = harness();

      const report =
        await h.service
          .processPending();

      expect(report).toMatchObject({
        selected: 1,
        sent: 1,
        failed: 0,
      });
      expect(
        h.send,
      ).toHaveBeenCalledTimes(1);

      const message =
        h.send.mock.calls[0]?.[0];

      expect(message.to).toBe(
        "cliente@example.com",
      );
      expect(
        message.attachments?.[0]
          ?.filename,
      ).toBe(
        "comprobante-H-A1B2C3D4.pdf",
      );

      expect(
        h.emailNotification.update,
      ).toHaveBeenCalledWith({
        where: {
          id: "email-1",
        },
        data: {
          status: "SENT",
          sentAt: expect.any(Date),
          claimedAt: null,
          lastError: null,
        },
      });
    });

    it("conserva FAILED para reintento cuando SMTP falla", async () => {
      const h = harness({
        sendError:
          new Error(
            "smtp unavailable",
          ),
      });

      const report =
        await h.service
          .processPending();

      expect(report.failed).toBe(1);
      expect(
        h.emailNotification.update,
      ).toHaveBeenCalledWith({
        where: {
          id: "email-1",
        },
        data: {
          status: "FAILED",
          claimedAt: null,
          lastError:
            "smtp unavailable",
        },
      });
    });

    it("marca SKIPPED si el pedido fue reembolsado antes del envío", async () => {
      const h = harness({
        orderStatus: "REFUNDED",
        paymentStatus:
          "REFUNDED",
      });

      const report =
        await h.service
          .processPending();

      expect(report.skipped).toBe(1);
      expect(
        h.send,
      ).not.toHaveBeenCalled();
      expect(
        h.emailNotification.update,
      ).toHaveBeenCalledWith({
        where: {
          id: "email-1",
        },
        data: {
          status: "SKIPPED",
          claimedAt: null,
          lastError:
            "Order is no longer eligible for purchase confirmation.",
        },
      });
    });
  },
);
