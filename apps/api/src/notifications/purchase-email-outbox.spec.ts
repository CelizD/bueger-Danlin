import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Prisma } from "../generated/prisma/client.js";
import { queuePurchaseConfirmationEmail } from "./purchase-email-outbox.js";

describe(
  "queuePurchaseConfirmationEmail",
  () => {
    it("normaliza y encola una sola confirmación por pedido", async () => {
      const tx = {
        emailNotification: {
          upsert: vi.fn().mockResolvedValue({
            id: "email-1",
          }),
        },
      } as unknown as Prisma.TransactionClient;

      await queuePurchaseConfirmationEmail(
        tx,
        {
          orderId: "order-1",
          email:
            "  CLIENTE@EXAMPLE.COM ",
        },
      );

      expect(
        tx.emailNotification.upsert,
      ).toHaveBeenCalledWith({
        where: {
          orderId_type: {
            orderId: "order-1",
            type:
              "PURCHASE_CONFIRMATION",
          },
        },
        update: {
          recipient:
            "cliente@example.com",
        },
        create: {
          orderId: "order-1",
          type:
            "PURCHASE_CONFIRMATION",
          recipient:
            "cliente@example.com",
          status: "PENDING",
        },
      });
    });

    it("no crea correo si el cliente no proporcionó email", async () => {
      const tx = {
        emailNotification: {
          upsert: vi.fn(),
        },
      } as unknown as Prisma.TransactionClient;

      const result =
        await queuePurchaseConfirmationEmail(
          tx,
          {
            orderId: "order-1",
            email: null,
          },
        );

      expect(result).toBeNull();
      expect(
        tx.emailNotification.upsert,
      ).not.toHaveBeenCalled();
    });
  },
);
