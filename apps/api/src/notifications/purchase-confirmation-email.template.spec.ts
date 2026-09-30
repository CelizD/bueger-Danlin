import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { ReceiptOrder } from "../orders/customer-order-receipt.js";
import { buildPurchaseConfirmationEmail } from "./purchase-confirmation-email.template.js";

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

function order(): ReceiptOrder {
  return {
    orderCode: "H-A1B2C3D4",
    status: "PAID",
    paymentStatus: "PAID",
    currency: "MXN",
    totalCents: 13_000,
    comboQuantity: 1,
    createdAt:
      new Date(
        "2026-09-29T22:00:00Z",
      ),
    purchaseTermsVersion:
      "2026-09-29-v2",
    purchaseTermsAcceptedAt:
      new Date(
        "2026-09-29T21:55:00Z",
      ),
    payment: {
      provider: "MERCADOPAGO",
      paidAt:
        new Date(
          "2026-09-29T22:00:00Z",
        ),
      refundedAt: null,
    },
    pickup: {
      startsAt:
        new Date(
          "2026-10-02T20:00:00Z",
        ),
      timezone:
        "America/Tijuana",
      pickupPoint: {
        name: "Universidad",
        address:
          "Entrada principal",
      },
    },
    groupDelivery: {
      finalized: false,
      freeDeliveryUnlocked:
        false,
      estimatedDeliveryFeeCents:
        5_000,
      finalFeeCents: null,
    },
    items: [
      {
        productName:
          "Hamburguesa + papas",
        quantity: 1,
        lineTotalCents: 13_000,
        modifiers: [],
      },
    ],
  };
}

describe(
  "buildPurchaseConfirmationEmail",
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

    it("incluye resumen y comprobante PDF sin token privado", () => {
      const message =
        buildPurchaseConfirmationEmail(
          {
            recipient:
              "cliente@example.com",
            order: order(),
          },
        );

      expect(message.to).toBe(
        "cliente@example.com",
      );
      expect(
        message.subject,
      ).toContain(
        "H-A1B2C3D4",
      );
      expect(message.text).toContain(
        "Total pagado",
      );
      expect(message.text).toContain(
        "Traslado estimado",
      );
      expect(message.text).not.toContain(
        "verificationToken",
      );
      expect(
        message.attachments,
      ).toHaveLength(1);
      expect(
        message.attachments?.[0]
          ?.filename,
      ).toBe(
        "comprobante-H-A1B2C3D4.pdf",
      );
      expect(
        message.attachments?.[0]
          ?.content
          .subarray(0, 8)
          .toString("latin1"),
      ).toBe("%PDF-1.4");
    });
  },
);
