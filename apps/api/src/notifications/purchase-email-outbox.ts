import type { Prisma } from "../generated/prisma/client.js";

export async function queuePurchaseConfirmationEmail(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    email: string | null;
  },
) {
  const recipient =
    input.email
      ?.trim()
      .toLowerCase() ?? "";

  if (!recipient) {
    return null;
  }

  return tx.emailNotification.upsert({
    where: {
      orderId_type: {
        orderId: input.orderId,
        type:
          "PURCHASE_CONFIRMATION",
      },
    },
    update: {
      recipient,
    },
    create: {
      orderId: input.orderId,
      type:
        "PURCHASE_CONFIRMATION",
      recipient,
      status: "PENDING",
    },
  });
}
