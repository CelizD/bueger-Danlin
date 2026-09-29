import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";

const staffOrderSelect = {
  id: true,
  orderCode: true,
  status: true,
  paymentStatus: true,
  currency: true,
  totalCents: true,
  comboQuantity: true,
  createdAt: true,
  updatedAt: true,
  deliveredAt: true,
  groupDeliveryFinalFeeCents: true,
  groupDeliveryFinalizedAt: true,
  groupDeliveryFeeCollectedAt: true,
  groupDeliveryFeeCollectedCents: true,
  customer: {
    select: {
      name: true,
      phone: true,
      email: true,
    },
  },
  pickupEvent: {
    select: {
      code: true,
      name: true,
      locationLabel: true,
      startsAt: true,
      timezone: true,
    },
  },
  items: {
    orderBy: { id: "asc" as const },
    select: {
      id: true,
      productName: true,
      unitPriceCents: true,
      quantity: true,
      lineTotalCents: true,
      modifiers: {
        orderBy: { id: "asc" as const },
        select: {
          id: true,
          optionName: true,
          priceDeltaCents: true,
          quantity: true,
          removed: true,
        },
      },
    },
  },
} as const;

function deliveryFeeUpdate(
  order: {
    groupDeliveryFinalFeeCents: number | null;
    groupDeliveryFeeCollectedAt: Date | null;
  },
  deliveryFeeCollected: boolean,
  now: Date,
) {
  const finalFeeCents =
    order.groupDeliveryFinalFeeCents;

  if (
    finalFeeCents === null ||
    finalFeeCents <= 0 ||
    order.groupDeliveryFeeCollectedAt
  ) {
    return {};
  }

  if (!deliveryFeeCollected) {
    throw new ConflictException(
      `Confirma que recibiste ${(finalFeeCents / 100).toFixed(2)} MXN de envío en efectivo antes de entregar.`,
    );
  }

  return {
    groupDeliveryFeeCollectedAt: now,
    groupDeliveryFeeCollectedCents:
      finalFeeCents,
  };
}

@Injectable()
export class StaffOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram?: TelegramNotificationService,
  ) {}

  async kitchenOrders() {
    return this.prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        status: {
          in: ["PAID", "CONFIRMED", "PREPARING", "READY"],
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 100,
      select: staffOrderSelect,
    });
  }

  async deliveryOrders() {
    return this.prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        status: {
          in: ["READY", "DELIVERED"],
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
      select: staffOrderSelect,
    });
  }

  async startPreparing(orderCodeInput: string, userId: string) {
    return this.transition(
      orderCodeInput,
      ["PAID", "CONFIRMED"],
      "PREPARING",
      userId,
      "Pedido enviado a preparación.",
    );
  }

  async markReady(orderCodeInput: string, userId: string) {
    return this.transition(
      orderCodeInput,
      ["PREPARING"],
      "READY",
      userId,
      "Pedido terminado y listo para entrega.",
    );
  }

  async markDelivered(
    orderCodeInput: string,
    userId: string,
    deliveryFeeCollected = false,
  ) {
    return this.transition(
      orderCodeInput,
      ["READY"],
      "DELIVERED",
      userId,
      "Pedido entregado al cliente.",
      deliveryFeeCollected,
    );
  }

  async deliverFromQr(
    qrPayloadInput: string,
    userId: string,
    deliveryFeeCollected = false,
  ) {
    const qrPayload = qrPayloadInput.trim();
    const parts = qrPayload.split(":");

    if (parts.length !== 3 || parts[0] !== "BD1") {
      throw new BadRequestException("El QR no pertenece a Burger Danlin.");
    }

    const orderCode = parts[1]?.trim().toUpperCase();
    const verificationToken = parts[2]?.trim();

    if (
      !orderCode ||
      !/^H-[A-F0-9]{8}$/.test(orderCode) ||
      !verificationToken ||
      verificationToken.length < 32 ||
      verificationToken.length > 128
    ) {
      throw new BadRequestException("El QR tiene un formato inválido.");
    }

    let deliveryNotice:
      | {
          orderCode: string;
          comboQuantity: number;
          totalCents: number;
          currency: string;
          status: "DELIVERED";
        }
      | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "orderCode" = ${orderCode}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException("El pedido del QR no existe.");
      }

      const order = await tx.order.findUnique({
        where: { orderCode },
        select: {
          ...staffOrderSelect,
          verificationTokenHash: true,
        },
      });

      if (!order) {
        throw new NotFoundException("El pedido del QR no existe.");
      }

      this.assertQrToken(order.verificationTokenHash, verificationToken);
      const { verificationTokenHash: _hiddenHash, ...safeOrder } = order;

      if (order.paymentStatus !== "PAID") {
        throw new ConflictException("El pedido todavía no está pagado.");
      }

      if (order.status === "DELIVERED") {
        return {
          ...safeOrder,
          alreadyDelivered: true,
        };
      }

      if (order.status !== "READY") {
        throw new ConflictException(
          `El pedido está en estado ${order.status}; todavía no está listo para entrega.`,
        );
      }

      const now = new Date();
      const feeUpdate =
        deliveryFeeUpdate(
          order,
          deliveryFeeCollected,
          now,
        );

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "DELIVERED",
          deliveredAt: now,
          ...feeUpdate,
        },
        select: staffOrderSelect,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: "READY",
          to: "DELIVERED",
          note: "Pedido entregado mediante QR validado.",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "ORDER_QR_DELIVERED",
          entityType: "Order",
          entityId: order.id,
          before: { status: "READY" },
          after: {
            status: "DELIVERED",
            method: "QR",
            deliveryFeeCollectedCents:
              updated.groupDeliveryFeeCollectedCents,
          },
        },
      });

      deliveryNotice = {
        orderCode: updated.orderCode,
        comboQuantity: updated.comboQuantity,
        totalCents: updated.totalCents,
        currency: updated.currency,
        status: "DELIVERED",
      };

      return {
        ...updated,
        alreadyDelivered: false,
      };
    });

    if (deliveryNotice) {
      this.telegram?.notifyStatusChanged(deliveryNotice);
    }

    return result;
  }

  private assertQrToken(expectedHash: string, verificationToken: string) {
    const actualHash = createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(actualHash, "hex");

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException("El QR no es válido para este pedido.");
    }
  }

  private async transition(
    orderCodeInput: string,
    allowedFrom: Array<"PAID" | "CONFIRMED" | "PREPARING" | "READY">,
    to: "PREPARING" | "READY" | "DELIVERED",
    userId: string,
    note: string,
    deliveryFeeCollected = false,
  ) {
    const orderCode = orderCodeInput.trim().toUpperCase();

    let statusNotice:
      | {
          orderCode: string;
          comboQuantity: number;
          totalCents: number;
          currency: string;
          status: "PREPARING" | "READY" | "DELIVERED";
        }
      | undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Order"
        WHERE "orderCode" = ${orderCode}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException("El pedido no existe.");
      }

      const order = await tx.order.findUnique({
        where: { orderCode },
        select: staffOrderSelect,
      });

      if (!order) {
        throw new NotFoundException("El pedido no existe.");
      }

      if (order.status === to) {
        return order;
      }

      if (order.paymentStatus !== "PAID") {
        throw new ConflictException("El pedido todavía no está pagado.");
      }

      if (!allowedFrom.includes(order.status as (typeof allowedFrom)[number])) {
        throw new ConflictException(
          `No se puede cambiar un pedido de ${order.status} a ${to}.`,
        );
      }

      const now = new Date();
      const feeUpdate =
        to === "DELIVERED"
          ? deliveryFeeUpdate(
              order,
              deliveryFeeCollected,
              now,
            )
          : {};

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: to,
          deliveredAt: to === "DELIVERED" ? now : order.deliveredAt,
          ...feeUpdate,
        },
        select: staffOrderSelect,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: order.status,
          to,
          note,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "ORDER_STATUS_CHANGED",
          entityType: "Order",
          entityId: order.id,
          before: { status: order.status },
          after: {
            status: to,
            ...(to === "DELIVERED"
              ? {
                  deliveryFeeCollectedCents:
                    updated.groupDeliveryFeeCollectedCents,
                }
              : {}),
          },
        },
      });

      statusNotice = {
        orderCode: updated.orderCode,
        comboQuantity: updated.comboQuantity,
        totalCents: updated.totalCents,
        currency: updated.currency,
        status: to,
      };

      return updated;
    });

    if (statusNotice) {
      this.telegram?.notifyStatusChanged(statusNotice);
    }

    return result;
  }
}
