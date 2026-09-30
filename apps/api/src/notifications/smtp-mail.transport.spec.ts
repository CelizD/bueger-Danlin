import {
  describe,
  expect,
  it,
} from "vitest";
import {
  smtpTestExports,
} from "./smtp-mail.transport.js";

describe(
  "SMTP MIME message",
  () => {
    it("adjunta PDF y codifica cuerpo sin exponer contenido binario", () => {
      const raw =
        smtpTestExports.mimeMessage(
          "Burger Danlin <no-reply@example.com>",
          "soporte@example.com",
          {
            to:
              "cliente@example.com",
            subject:
              "Pago confirmado · H-A1B2C3D4",
            text:
              "Pago confirmado",
            html:
              "<strong>Pago confirmado</strong>",
            attachments: [
              {
                filename:
                  "comprobante-H-A1B2C3D4.pdf",
                contentType:
                  "application/pdf",
                content:
                  Buffer.from(
                    "%PDF-1.4 test",
                    "utf8",
                  ),
              },
            ],
          },
        );

      expect(raw).toContain(
        "multipart/mixed",
      );
      expect(raw).toContain(
        "multipart/alternative",
      );
      expect(raw).toContain(
        "application/pdf",
      );
      expect(raw).toContain(
        'filename="comprobante-H-A1B2C3D4.pdf"',
      );
      expect(raw).toContain(
        Buffer.from(
          "%PDF-1.4 test",
        ).toString(
          "base64",
        ),
      );
      expect(raw).not.toContain(
        "%PDF-1.4 test",
      );
    });
  },
);
