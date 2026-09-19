import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

const detailInclude = {
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
    include: {
      modifiers: {
        orderBy: { id: "asc" as const },
      },
    },
  },
};

@Injectable()
export class StaffOrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: detailInclude,
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
      include: detailInclude,
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

  async markDelivered(orderCodeInput: string, userId: string) {
    return this.transition(
      orderCodeInput,
      ["READY"],
      "DELIVERED",
      userId,
      "Pedido entregado al cliente.",
    );
  }

  private async transition(
    orderCodeInput: string,
    allowedFrom: Array<"PAID" | "CONFIRMED" | "PREPARING" | "READY">,
    to: "PREPARING" | "READY" | "DELIVERED",
    userId: string,
    note: string,
  ) {
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
        include: detailInclude,
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

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: to,
          deliveredAt: to === "DELIVERED" ? now : order.deliveredAt,
        },
        include: detailInclude,
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
          after: { status: to },
        },
      });

      return updated;
    });
  }
}
