import {
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { readSetting } from "../config/secret-setting.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { presentCreatedOrder } from "./order-create-presenter.js";
import { prepareCreateOrderRequest } from "./order-create-request.js";
import { createOrderTransaction } from "./order-create-transaction.js";

const IDEMPOTENCY_REPLAY_RETRY_DELAYS_MS = [
  0,
  10,
  25,
  50,
  100,
] as const;

@Injectable()
export class OrdersService {
  private readonly qrSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly telegram?: TelegramNotificationService,
  ) {
    const secret = readSetting("QR_TOKEN_SECRET");

    if (!secret) {
      throw new Error("QR_TOKEN_SECRET is required");
    }

    this.qrSecret = secret;
  }

  async create(
    dto: CreateOrderDto,
    idempotencyKey: string,
  ) {
    const {
      requestKey,
      requestHash,
      normalizedRequest,
    } = prepareCreateOrderRequest(
      dto,
      idempotencyKey,
    );

    const replay =
      await this.prisma.order.findUnique({
        where: { requestKey },
        include: {
          pickupEvent: true,
        },
      });

    if (replay) {
      if (replay.requestHash !== requestHash) {
        throw new ConflictException(
          "La misma Idempotency-Key ya fue usada con otro pedido.",
        );
      }

      return presentCreatedOrder(
        replay,
        this.qrSecret,
      );
    }

    try {
      const created = await createOrderTransaction(
        this.prisma,
        this.inventory,
        dto,
        requestKey,
        requestHash,
        normalizedRequest,
        this.qrSecret,
      );

      this.telegram?.notifyOrderCreated({
        orderCode: created.orderCode,
        comboQuantity: created.comboQuantity,
        totalCents: created.totalCents,
        currency: created.currency,
        locationLabel:
          created.pickup.locationLabel,
      });

      return created;
    } catch (error) {
      const code =
        (error as { code?: string }).code;

      if (code === "P2002") {
        return this.recoverConcurrentReplay(
          requestKey,
          requestHash,
        );
      }

      throw error;
    }
  }

  private async recoverConcurrentReplay(
    requestKey: string,
    requestHash: string,
  ) {
    for (const delayMs of IDEMPOTENCY_REPLAY_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await delay(delayMs);
      }

      const existing =
        await this.prisma.order.findUnique({
          where: { requestKey },
          include: {
            pickupEvent: true,
          },
        });

      if (!existing) {
        continue;
      }

      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          "La misma Idempotency-Key ya fue usada con otro pedido.",
        );
      }

      return presentCreatedOrder(
        existing,
        this.qrSecret,
      );
    }

    throw new ConflictException(
      "El pedido concurrente todavía se está procesando. Reintenta con la misma Idempotency-Key.",
    );
  }
}
