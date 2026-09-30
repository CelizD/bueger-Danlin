import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import { PurchaseEmailService } from "../notifications/purchase-email.service.js";
import { reconcileMercadoPagoWebhook } from "./mercadopago-webhook-reconciliation.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { claimPaymentWebhookEvent } from "./payment-webhook-event.js";
import { WebhookSecurityService } from "./webhook-security.service.js";

export { shouldApplyPaymentStatus } from "./payment-webhook-status.js";

export type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  date_created?: string;
  data?: {
    id?: string;
  };
};

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
    private readonly purchaseEmail?: PurchaseEmailService,
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
    const claim = await claimPaymentWebhookEvent(
      this.prisma,
      {
        eventId,
        replayKey,
        resourceId,
        requestId: input.requestId,
        type,
        bodyHash: hash,
      },
    );

    if (!claim.claimed) {
      return {
        accepted: true,
        duplicate: true,
        eventId,
        status: claim.status,
      };
    }

    try {
      const result = await reconcileMercadoPagoWebhook(
        {
          prisma: this.prisma,
          inventory: this.inventory,
          providers: this.providers,
          telegram: this.telegram,
          groupTelegram: this.groupTelegram,
          purchaseEmail: this.purchaseEmail,
        },
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
}
