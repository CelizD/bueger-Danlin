import { ConflictException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";

const WEBHOOK_PROCESSING_STALE_MS = 2 * 60_000;

export type ClaimPaymentWebhookEventInput = {
  eventId: string;
  replayKey: string;
  resourceId: string;
  requestId?: string;
  type: string;
  bodyHash: string;
};

export async function claimPaymentWebhookEvent(
  prisma: PrismaService,
  input: ClaimPaymentWebhookEventInput,
) {
  let event:
    | {
        id: string;
        eventId: string;
        replayKey: string;
        resourceId: string;
        type: string;
        bodyHash: string;
        status:
          | "RECEIVED"
          | "PROCESSING"
          | "PROCESSED"
          | "IGNORED"
          | "FAILED";
        updatedAt: Date;
      }
    | null
    | undefined;

  try {
    event = await prisma.paymentWebhookEvent.create({
      data: {
        provider: "MERCADOPAGO",
        eventId: input.eventId,
        replayKey: input.replayKey,
        resourceId: input.resourceId,
        requestId: input.requestId,
        type: input.type,
        bodyHash: input.bodyHash,
      },
      select: {
        id: true,
        eventId: true,
        replayKey: true,
        resourceId: true,
        type: true,
        bodyHash: true,
        status: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") {
      throw error;
    }

    event =
      await prisma.paymentWebhookEvent.findFirst({
        where: {
          provider: "MERCADOPAGO",
          OR: [
            { eventId: input.eventId },
            { replayKey: input.replayKey },
          ],
        },
        select: {
          id: true,
          eventId: true,
          replayKey: true,
          resourceId: true,
          type: true,
          bodyHash: true,
          status: true,
          updatedAt: true,
        },
      });

    if (!event) throw error;

    const replayCollision =
      event.replayKey === input.replayKey &&
      event.eventId !== input.eventId;

    if (
      replayCollision ||
      event.resourceId !== input.resourceId ||
      event.type !== input.type ||
      event.bodyHash !== input.bodyHash
    ) {
      throw new ConflictException(
        "Colisión detectada en el identificador del webhook.",
      );
    }
  }

  if (
    event.status === "PROCESSED" ||
    event.status === "IGNORED"
  ) {
    return {
      id: event.id,
      claimed: false as const,
      status: event.status,
    };
  }

  const staleBefore = new Date(
    Date.now() - WEBHOOK_PROCESSING_STALE_MS,
  );

  if (
    event.status === "PROCESSING" &&
    event.updatedAt > staleBefore
  ) {
    return {
      id: event.id,
      claimed: false as const,
      status: event.status,
    };
  }

  const claimed =
    await prisma.paymentWebhookEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          {
            status: {
              in: ["RECEIVED", "FAILED"],
            },
          },
          {
            status: "PROCESSING",
            updatedAt: { lte: staleBefore },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });

  if (claimed.count !== 1) {
    return {
      id: event.id,
      claimed: false as const,
      status: "PROCESSING" as const,
    };
  }

  return {
    id: event.id,
    claimed: true as const,
    status: "PROCESSING" as const,
  };
}
