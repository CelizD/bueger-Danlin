import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import type { ProviderPaymentStatus } from "./domain/payment-provider.types.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { WebhookSecurityService } from "./webhook-security.service.js";

export type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  date_created?: string;
  data?: {
    id?: string;
  };
};

const WEBHOOK_PROCESSING_STALE_MS = 2 * 60_000;

const STATUS_RANK: Record<ProviderPaymentStatus, number> = {
  PENDING: 0,
  PROCESSING: 1,
  FAILED: 2,
  CANCELLED: 2,
  PAID: 3,
  PARTIALLY_REFUNDED: 4,
  REFUNDED: 5,
};

export function shouldApplyPaymentStatus(
  current: ProviderPaymentStatus,
  incoming: ProviderPaymentStatus,
) {
  if (current === incoming) return false;

  if (current === "REFUNDED") return false;

  if (
    current === "PARTIALLY_REFUNDED" &&
    incoming !== "REFUNDED"
  ) {
    return false;
  }

  if (
    current === "PAID" &&
    !["PARTIALLY_REFUNDED", "REFUNDED"].includes(incoming)
  ) {
    return false;
  }

  return STATUS_RANK[incoming] > STATUS_RANK[current];
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 220);
}

function sha256(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function bodyHash(body: MercadoPagoWebhookBody) {
  return sha256(JSON.stringify(body));
}

function webhookEventId(
  body: MercadoPagoWebhookBody,
  resourceId: string,
  type: string,
) {
  const explicit = String(body.id ?? "").trim();

  if (explicit) return explicit;

  const action = String(body.action ?? "").trim();
  const createdAt = String(body.date_created ?? "").trim();

  if (!action || !createdAt) {
    throw new BadRequestException(
      "Webhook Mercado Pago sin identidad estable.",
    );
  }

  return "fp:" +
    sha256([type, action, createdAt, resourceId].join("|"));
}

@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly providers: PaymentProviderRegistry,
    private readonly security: WebhookSecurityService,
    private readonly telegram?: TelegramNotificationService,
    private readonly groupTelegram?: GroupTelegramNotificationService,
  ) {}

  async handleMercadoPago(input: {
    body: MercadoPagoWebhookBody;
    signatureHeader: string | undefined;
    requestId: string | undefined;
    dataId: string | undefined;
    queryType: string | undefined;
  }) {
    const body = input.body ?? {};
    const resourceId = String(input.dataId ?? "").trim();
    const bodyResourceId = String(body.data?.id ?? "").trim();
    const type = String(input.queryType ?? body.type ?? "").trim();

    if (
      !resourceId ||
      resourceId.length > 128 ||
      type !== "order"
    ) {
      throw new BadRequestException(
        "Webhook Mercado Pago inválido.",
      );
    }

    if (!bodyResourceId || bodyResourceId !== resourceId) {
      throw new UnauthorizedException(
        "El recurso del webhook no coincide.",
      );
    }

    if (body.type && body.type !== type) {
      throw new UnauthorizedException(
        "El tipo del webhook no coincide.",
      );
    }

    this.security.verifyMercadoPago({
      signatureHeader: input.signatureHeader,
      requestId: input.requestId,
      dataId: resourceId,
    });

    const eventId = webhookEventId(body, resourceId, type);
    const replayKey = sha256(
      [
        input.signatureHeader ?? "",
        input.requestId ?? "",
        resourceId,
      ].join("|"),
    );

    if (eventId.length > 128) {
      throw new BadRequestException(
        "Identificador de webhook demasiado largo.",
      );
    }

    const hash = bodyHash(body);
    const claim = await this.claimEvent({
      eventId,
      replayKey,
      resourceId,
      requestId: input.requestId,
      type,
      bodyHash: hash,
    });

    if (!claim.claimed) {
      return {
        accepted: true,
        duplicate: true,
        eventId,
        status: claim.status,
      };
    }

    try {
      const result = await this.reconcileMercadoPago(
        claim.id,
        resourceId,
      );

      return {
        accepted: true,
        duplicate: false,
        eventId,
        ...result,
      };
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: claim.id },
        data: {
          status: "FAILED",
          lastError: safeError(error),
        },
      });

      throw error;
    }
  }

  private async claimEvent(input: {
    eventId: string;
    replayKey: string;
    resourceId: string;
    requestId?: string;
    type: string;
    bodyHash: string;
  }) {
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
      | undefined;

    try {
      event = await this.prisma.paymentWebhookEvent.create({
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
        await this.prisma.paymentWebhookEvent.findFirst({
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
      await this.prisma.paymentWebhookEvent.updateMany({
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

  private async reconcileMercadoPago(
    webhookEventId: string,
    resourceId: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: "MERCADOPAGO",
        externalId: resourceId,
      },
      select: {
        id: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        "El webhook no corresponde a un pago conocido.",
      );
    }

    const provider = this.providers.get("mercadopago");
    const canonical = await provider.getPayment(resourceId);

    if (canonical.externalId !== resourceId) {
      throw new ConflictException(
        "Mercado Pago devolvió un recurso diferente.",
      );
    }

    let paymentNotice:
      | {
          orderCode: string;
          comboQuantity: number;
          totalCents: number;
          currency: string;
          locationLabel?: string;
          pickupEventId: string;
        }
      | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${payment.id}
        FOR UPDATE
      `;

      const current = await tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          order: {
            include: {
              pickupEvent: true,
            },
          },
        },
      });

      if (!current) {
        throw new NotFoundException("El pago ya no existe.");
      }

      if (
        canonical.amountCents !== current.amountCents ||
        canonical.currency !== current.currency
      ) {
        throw new ConflictException(
          "Monto o moneda del webhook no coincide con el pago.",
        );
      }

      const currentStatus =
        current.status as ProviderPaymentStatus;
      const incomingStatus = canonical.status;

      if (
        !shouldApplyPaymentStatus(
          currentStatus,
          incomingStatus,
        )
      ) {
        await tx.paymentWebhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status:
              currentStatus === incomingStatus
                ? "PROCESSED"
                : "IGNORED",
            processedAt: new Date(),
          },
        });

        if (currentStatus !== incomingStatus) {
          await tx.auditLog.create({
            data: {
              action: "PAYMENT_WEBHOOK_IGNORED",
              entityType: "Payment",
              entityId: current.id,
              before: { status: currentStatus },
              after: {
                incomingStatus,
                reason: "NON_FORWARD_TRANSITION",
              },
            },
          });
        }

        return {
          applied: false,
          paymentStatus: currentStatus,
        };
      }

      const now = new Date();
      const paymentData: {
        status: ProviderPaymentStatus;
        paidAt?: Date;
        refundedAt?: Date;
      } = {
        status: incomingStatus,
      };

      if (incomingStatus === "PAID") {
        paymentData.paidAt = canonical.paidAt ?? now;
      }

      if (incomingStatus === "REFUNDED") {
        paymentData.refundedAt = now;
      }

      await tx.payment.update({
        where: { id: current.id },
        data: paymentData,
      });

      const order = current.order;

      if (
        incomingStatus === "PAID" &&
        order.status === "PENDING_PAYMENT"
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            paymentStatus: "PAID",
            reservationExpiresAt: null,
          },
        });

        await this.inventory.commitOrder(tx, order.id);

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: "PENDING_PAYMENT",
            to: "PAID",
            note:
              "Pago confirmado mediante webhook verificado de Mercado Pago.",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "PAYMENT_CONFIRMED",
            entityType: "Payment",
            entityId: current.id,
            before: {
              orderStatus: order.status,
              paymentStatus: currentStatus,
            },
            after: {
              orderId: order.id,
              provider: "MERCADOPAGO",
              status: "PAID",
              amountCents: current.amountCents,
              currency: current.currency,
              orderStatus: "PAID",
              paymentStatus: "PAID",
              source: "WEBHOOK",
            },
          },
        });

        paymentNotice = {
          orderCode: order.orderCode,
          comboQuantity: order.comboQuantity,
          totalCents: order.totalCents,
          currency: order.currency,
          locationLabel: order.pickupEvent.locationLabel,
          pickupEventId: order.pickupEvent.id,
        };
      } else if (
        ["PENDING", "PROCESSING", "FAILED", "CANCELLED"].includes(
          incomingStatus,
        ) &&
        order.status === "PENDING_PAYMENT"
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: incomingStatus,
          },
        });
      } else if (incomingStatus === "PARTIALLY_REFUNDED") {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PARTIALLY_REFUNDED",
          },
        });
      } else if (incomingStatus === "REFUNDED") {
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "REFUNDED",
            ...(order.status === "CANCELLED"
              ? { status: "REFUNDED" }
              : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_WEBHOOK_APPLIED",
          entityType: "Payment",
          entityId: current.id,
          before: {
            status: currentStatus,
          },
          after: {
            status: incomingStatus,
            resourceId,
          },
        },
      });

      await tx.paymentWebhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "PROCESSED",
          processedAt: now,
        },
      });

      return {
        applied: true,
        paymentStatus: incomingStatus,
      };
    });

    if (paymentNotice) {
      this.telegram?.notifyPaymentConfirmed(paymentNotice);
      await this.groupTelegram?.observeCompleted(
        paymentNotice.pickupEventId,
      );
    }

    return result;
  }
}
