import {
  BadRequestException,
} from "@nestjs/common";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import type { ArcoNotificationService } from "./arco-notification.service.js";
import { PrivacyService } from "./privacy.service.js";

function harness() {
  const createdAt =
    new Date(
      "2026-09-30T12:00:00.000Z",
    );

  const create =
    vi.fn().mockImplementation(
      ({ data }) =>
        Promise.resolve({
          id: "arco-1",
          folio:
            data.folio,
          email:
            data.email,
          rights:
            data.rights,
          status:
            "IDENTITY_VERIFICATION_REQUIRED",
          createdAt,
        }),
    );

  const auditCreate =
    vi.fn().mockResolvedValue({
      id: "audit-1",
    });

  const tx = {
    arcoRequest: {
      create,
    },
    auditLog: {
      create: auditCreate,
    },
  };

  const prisma = {
    $transaction:
      vi.fn(
        async (
          callback: (
            input:
              typeof tx,
          ) =>
            Promise<unknown>,
        ) =>
          callback(tx),
      ),
  } as unknown as PrismaService;

  const notifyReceived =
    vi.fn().mockResolvedValue(
      undefined,
    );

  const notifications = {
    notifyReceived,
  } as unknown as ArcoNotificationService;

  return {
    service:
      new PrivacyService(
        prisma,
        notifications,
      ),
    create,
    auditCreate,
    notifyReceived,
  };
}

describe(
  "PrivacyService ARCO",
  () => {
    it(
      "registra solicitud con folio y auditoría sin PII",
      async () => {
        const h =
          harness();

        const result =
          await h.service
            .createArcoRequest({
              name:
                " Daniel ",
              email:
                "DANIEL@EXAMPLE.COM",
              phone:
                "+52 664 123 4567",
              rights: [
                "ACCESS",
              ],
              description:
                "Quiero saber qué datos tienen sobre mí.",
              locatorInfo:
                "Pedido H-A1B2C3D4",
              identityVerificationAcknowledged:
                true,
            });

        expect(
          result.folio,
        ).toMatch(
          /^ARCO-\d{8}-[A-F0-9]{8}$/,
        );

        expect(
          h.create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining(
                {
                  name:
                    "Daniel",
                  email:
                    "daniel@example.com",
                  rights: [
                    "ACCESS",
                  ],
                  status:
                    "IDENTITY_VERIFICATION_REQUIRED",
                },
              ),
          }),
        );

        const auditPayload =
          h.auditCreate.mock
            .calls[0]?.[0];

        expect(
          JSON.stringify(
            auditPayload,
          ),
        ).not.toContain(
          "daniel@example.com",
        );
        expect(
          JSON.stringify(
            auditPayload,
          ),
        ).not.toContain(
          "Quiero saber",
        );

        expect(
          h.notifyReceived,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            folio:
              result.folio,
            requesterEmail:
              "daniel@example.com",
            rights: [
              "ACCESS",
            ],
          }),
        );
      },
    );

    it(
      "exige detalle al solicitar rectificación",
      async () => {
        const h =
          harness();

        await expect(
          h.service
            .createArcoRequest({
              name:
                "Daniel",
              email:
                "daniel@example.com",
              rights: [
                "RECTIFICATION",
              ],
              description:
                "Quiero corregir mis datos personales registrados.",
              identityVerificationAcknowledged:
                true,
            }),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  },
);
