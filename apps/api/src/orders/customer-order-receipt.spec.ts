import {
  describe,
  expect,
  it,
} from "vitest";
import { buildCustomerOrderReceiptPdf } from "./customer-order-receipt.js";

describe(
  "buildCustomerOrderReceiptPdf",
  () => {
    it("genera un PDF con folio, vendedor, total y traslado", () => {
      const pdf =
        buildCustomerOrderReceiptPdf(
          {
            orderCode:
              "H-A1B2C3D4",
            status: "PAID",
            paymentStatus: "PAID",
            currency: "MXN",
            totalCents: 14_000,
            comboQuantity: 1,
            createdAt:
              "2026-09-29T23:00:00.000Z",
            purchaseTermsVersion:
              "2026-09-29-v2",
            purchaseTermsAcceptedAt:
              "2026-09-29T23:00:00.000Z",
            payment: {
              provider:
                "MERCADOPAGO",
              paidAt:
                "2026-09-29T23:01:00.000Z",
              refundedAt: null,
            },
            pickup: {
              startsAt:
                "2026-10-03T19:00:00.000Z",
              timezone:
                "America/Tijuana",
              pickupPoint: {
                name: "Universidad",
                address:
                  "Entrada principal",
              },
            },
            groupDelivery: {
              finalized: true,
              freeDeliveryUnlocked:
                false,
              estimatedDeliveryFeeCents:
                5_000,
              finalFeeCents: 5_000,
            },
            items: [
              {
                productName:
                  "Hamburguesa + papas",
                quantity: 1,
                lineTotalCents:
                  14_000,
                modifiers: [
                  {
                    optionName:
                      "Queso extra",
                    removed: false,
                    priceDeltaCents:
                      1_000,
                  },
                  {
                    optionName:
                      "Cebolla",
                    removed: true,
                    priceDeltaCents:
                      0,
                  },
                ],
              },
            ],
          },
          {
            legalName:
              "Persona Vendedora",
            tradeName:
              "Burger Danlin",
            rfc:
              "ABCD010101ABC",
            address:
              "Domicilio comercial 123",
            supportPhone:
              "+52 664 123 4567",
            supportEmail:
              "soporte@example.com",
          },
        );

      expect(
        pdf.subarray(0, 8).toString(
          "latin1",
        ),
      ).toBe("%PDF-1.4");

      const text =
        pdf.toString("latin1");

      expect(text).toContain(
        "COMPROBANTE DE COMPRA",
      );
      expect(text).toContain(
        "H-A1B2C3D4",
      );
      expect(text).toContain(
        "ABCD010101ABC",
      );
      expect(text).toContain(
        "$140.00 MXN",
      );
      expect(text).toContain(
        "$50.00 MXN",
      );
      expect(text).toContain(
        "No es CFDI",
      );
      expect(text).toContain(
        "%%EOF",
      );
    });
  },
);
