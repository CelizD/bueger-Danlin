import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";

const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED", "REFUNDED", "NO_SHOW"] as const;
const CAPACITY_STATUSES = ["PAID", "CONFIRMED", "PREPARING", "READY", "DELIVERED"] as const;

@Injectable()
export class CustomerOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrder(orderCodeInput: string, verificationToken: string) {
    const orderCode = orderCodeInput.trim().toUpperCase();
    const order = await this.prisma.order.findUnique({
      where: { orderCode },
      include: {
        pickupEvent: true,
        items: {
          orderBy: { id: "asc" },
          include: { modifiers: { orderBy: { id: "asc" } } },
        },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) throw new NotFoundException("El pedido no existe.");
    this.assertVerificationToken(order.verificationTokenHash, verificationToken);

    const now = new Date();
    const canCancel =
      now < order.pickupEvent.closesAt &&
      !TERMINAL_STATUSES.includes(order.status as (typeof TERMINAL_STATUSES)[number]);

    const latestPayment = order.payments[0] ?? null;
    const refundRequested = this.hasRefundRequest(latestPayment?.metadata);

    return {
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      totalCents: order.totalCents,
      comboQuantity: order.comboQuantity,
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt,
      canCancel,
      cancellationDeadline: order.pickupEvent.closesAt,
      refundStatus:
        order.paymentStatus === "REFUNDED"
          ? "REFUNDED"
          : refundRequested
            ? "PENDING"
            : null,
      pickup: {
        locationLabel: order.pickupEvent.locationLabel,
        startsAt: order.pickupEvent.startsAt,
        closesAt: order.pickupEvent.closesAt,
        timezone: order.pickupEvent.timezone,
      },
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
        modifiers: item.modifiers.map((modifier) => ({
          id: modifier.id,
          optionName: modifier.optionName,
          removed: modifier.removed,
          priceDeltaCents: modifier.priceDeltaCents,
        })),
      })),
    };
  }

  async cancel(orderCodeInput: string, verificationToken: string) {
    const orderCode = orderCodeInput.trim().toUpperCase();

    return this.prisma.$transaction(async (tx) => {
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
        include: {
          pickupEvent: true,
          payments: { orderBy: { createdAt: "desc" } },
        },
      });

      if (!order) throw new NotFoundException("El pedido no existe.");
      this.assertVerificationToken(order.verificationTokenHash, verificationToken);

      if (order.status === "CANCELLED" || order.status === "REFUNDED") {
        const latestPayment = order.payments[0] ?? null;
        return {
          orderCode: order.orderCode,
          status: order.status,
          paymentStatus: order.paymentStatus,
          refundStatus:
            order.status === "REFUNDED"
              ? "REFUNDED"
              : this.hasRefundRequest(latestPayment?.metadata)
                ? "PENDING"
                : null,
          alreadyCancelled: true,
        };
      }

      if (order.status === "DELIVERED" || order.status === "NO_SHOW") {
        throw new ConflictException("Este pedido ya no puede cancelarse.");
      }

      const now = new Date();

      if (now >= order.pickupEvent.closesAt) {
        throw new ConflictException("El tiempo para cancelar este pedido ya terminó.");
      }

      const fromStatus = order.status;
      const paidPayment = order.payments.find((payment) => payment.status === "PAID");

      if (order.paymentStatus === "PAID" && !paidPayment) {
        throw new ConflictException(
          "El pedido está marcado como pagado pero no se encontró el registro del pago.",
        );
      }

      if (!paidPayment) {
        await tx.payment.updateMany({
          where: {
            orderId: order.id,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          data: { status: "CANCELLED" },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            paymentStatus: "CANCELLED",
            reservationExpiresAt: null,
            cancelledAt: now,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: fromStatus,
            to: "CANCELLED",
            note: "Pedido cancelado por el cliente antes del cierre.",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "CUSTOMER_ORDER_CANCELLED",
            entityType: "Order",
            entityId: order.id,
            before: { status: fromStatus, paymentStatus: order.paymentStatus },
            after: { status: "CANCELLED", paymentStatus: "CANCELLED" },
          },
        });

        await this.reopenCapacityIfNeeded(tx, order.pickupEventId, order.pickupEvent);

        return {
          orderCode: order.orderCode,
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          refundStatus: null,
          alreadyCancelled: false,
        };
      }

      if (paidPayment.provider === "MOCK") {
        await tx.payment.update({
          where: { id: paidPayment.id },
          data: {
            status: "REFUNDED",
            refundedAt: now,
            metadata: this.withRefundMetadata(paidPayment.metadata, now, "completed"),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "REFUNDED",
            paymentStatus: "REFUNDED",
            reservationExpiresAt: null,
            cancelledAt: now,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: fromStatus,
            to: "CANCELLED",
            note: "Pedido cancelado por el cliente antes del cierre.",
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: "CANCELLED",
            to: "REFUNDED",
            note: "Reembolso local simulado completado.",
          },
        });

        await tx.auditLog.create({
          data: {
            action: "CUSTOMER_ORDER_REFUNDED",
            entityType: "Order",
            entityId: order.id,
            before: { status: fromStatus, paymentStatus: order.paymentStatus },
            after: { status: "REFUNDED", paymentStatus: "REFUNDED", provider: "MOCK" },
          },
        });

        await this.reopenCapacityIfNeeded(tx, order.pickupEventId, order.pickupEvent);

        return {
          orderCode: order.orderCode,
          status: "REFUNDED",
          paymentStatus: "REFUNDED",
          refundStatus: "REFUNDED",
          alreadyCancelled: false,
        };
      }

      await tx.payment.update({
        where: { id: paidPayment.id },
        data: {
          metadata: this.withRefundMetadata(paidPayment.metadata, now, "requested"),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          reservationExpiresAt: null,
          cancelledAt: now,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          from: fromStatus,
          to: "CANCELLED",
          note: "Pedido cancelado por el cliente; reembolso solicitado al proveedor.",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CUSTOMER_REFUND_REQUESTED",
          entityType: "Order",
          entityId: order.id,
          before: { status: fromStatus, paymentStatus: order.paymentStatus },
          after: {
            status: "CANCELLED",
            paymentStatus: order.paymentStatus,
            provider: paidPayment.provider,
            refundStatus: "PENDING",
          },
        },
      });

      await this.reopenCapacityIfNeeded(tx, order.pickupEventId, order.pickupEvent);

      return {
        orderCode: order.orderCode,
        status: "CANCELLED",
        paymentStatus: order.paymentStatus,
        refundStatus: "PENDING",
        alreadyCancelled: false,
      };
    });
  }

  private async reopenCapacityIfNeeded(tx: any, pickupEventId: string, pickupEvent: { status: string; maxCombos: number; closesAt: Date }) {
    if (pickupEvent.status !== "SOLD_OUT" || pickupEvent.closesAt <= new Date()) return;

    const capacity = await tx.order.aggregate({
      where: {
        pickupEventId,
        OR: [
          { status: { in: [...CAPACITY_STATUSES] } },
          {
            status: "PENDING_PAYMENT",
            reservationExpiresAt: { gt: new Date() },
          },
        ],
      },
      _sum: { comboQuantity: true },
    });

    if ((capacity._sum.comboQuantity ?? 0) < pickupEvent.maxCombos) {
      await tx.pickupEvent.update({
        where: { id: pickupEventId },
        data: { status: "OPEN" },
      });
    }
  }

  private hasRefundRequest(metadata: unknown) {
    return !!(
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      "refundRequestedAt" in metadata
    );
  }

  private withRefundMetadata(
    metadata: unknown,
    now: Date,
    status: "requested" | "completed",
  ): any {
    const base =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};

    return {
      ...base,
      refundRequestedAt: now.toISOString(),
      refundStatus: status,
      ...(status === "completed" ? { refundCompletedAt: now.toISOString() } : {}),
      refundReason: "customer_cancelled_before_cutoff",
    };
  }

  private assertVerificationToken(expectedHash: string, verificationToken: string) {
    const actualHash = createHash("sha256").update(verificationToken).digest("hex");
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(actualHash, "hex");

    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException("Token de pedido inválido.");
    }
  }
}
