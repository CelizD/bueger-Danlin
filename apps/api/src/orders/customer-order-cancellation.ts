import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import { reopenCustomerOrderCapacityIfNeeded } from "./customer-order-capacity.js";
import {
  hasRefundRequest,
  withRefundMetadata,
} from "./customer-order-refund.js";
import type { CustomerRefundRequest } from "./customer-order-refund-processing.js";
import { assertOrderVerificationToken } from "./customer-order-security.js";

export type CustomerOrderCancellationNotice = {
  orderCode: string;
  comboQuantity: number;
  totalCents: number;
  currency: string;
  locationLabel?: string;
  refundStatus?: "PENDING" | "REFUNDED" | null;
};

export async function cancelCustomerOrder(
  prisma: PrismaService,
  inventory: InventoryService,
  orderCodeInput: string,
  verificationToken: string,
) {
  const orderCode = orderCodeInput.trim().toUpperCase();

  let cancellationNotice:
    | CustomerOrderCancellationNotice
    | undefined;
  let refundRequest:
    | CustomerRefundRequest
    | undefined;

  const result = await prisma.$transaction(async (tx) => {
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
        pickupEvent: {
          include: {
            pickupPoint: true,
          },
        },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!order) {
      throw new NotFoundException("El pedido no existe.");
    }

    assertOrderVerificationToken(
      order.verificationTokenHash,
      verificationToken,
    );

    if (
      order.status === "CANCELLED" ||
      order.status === "REFUNDED"
    ) {
      const latestPayment = order.payments[0] ?? null;
      const refundPending =
        order.status === "CANCELLED" &&
        latestPayment?.status === "PAID" &&
        latestPayment.provider !== "MOCK" &&
        hasRefundRequest(latestPayment.metadata);

      if (
        refundPending &&
        latestPayment?.externalId &&
        (latestPayment.provider === "MERCADOPAGO" ||
          latestPayment.provider === "STRIPE")
      ) {
        refundRequest = {
          paymentId: latestPayment.id,
          orderId: order.id,
          orderCode: order.orderCode,
          provider: latestPayment.provider,
          externalId: latestPayment.externalId,
          amountCents: latestPayment.amountCents,
          metadata: latestPayment.metadata,
        };
      }

      return {
        orderCode: order.orderCode,
        status: order.status,
        paymentStatus: order.paymentStatus,
        refundStatus:
          order.status === "REFUNDED"
            ? "REFUNDED"
            : refundPending
              ? "PENDING"
              : null,
        alreadyCancelled: true,
      };
    }

    if (
      order.status === "DELIVERED" ||
      order.status === "NO_SHOW"
    ) {
      throw new ConflictException(
        "Este pedido ya no puede cancelarse.",
      );
    }

    const now = new Date();

    if (
      order.pickupEvent.groupDeliveryFinalizedAt ||
      order.pickupEvent.status === "CLOSED" ||
      now >= order.pickupEvent.closesAt
    ) {
      throw new ConflictException(
        "El punto de entrega ya cerró y este pedido ya no puede cancelarse.",
      );
    }

    const fromStatus = order.status;
    const paidPayment = order.payments.find(
      (payment) => payment.status === "PAID",
    );

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
          note:
            "Pedido cancelado por el cliente antes del cierre.",
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CUSTOMER_ORDER_CANCELLED",
          entityType: "Order",
          entityId: order.id,
          before: {
            status: fromStatus,
            paymentStatus: order.paymentStatus,
          },
          after: {
            status: "CANCELLED",
            paymentStatus: "CANCELLED",
          },
        },
      });

      await inventory.releaseOrder(tx, order.id);
      await reopenCustomerOrderCapacityIfNeeded(
        tx,
        order.pickupEventId,
        order.pickupEvent,
      );

      cancellationNotice = {
        orderCode: order.orderCode,
        comboQuantity: order.comboQuantity,
        totalCents: order.totalCents,
        currency: order.currency,
        locationLabel: order.pickupEvent.locationLabel,
        refundStatus: null,
      };

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
          metadata: withRefundMetadata(
            paidPayment.metadata,
            now,
            "completed",
          ),
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
          note:
            "Pedido cancelado por el cliente antes del cierre.",
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
          before: {
            status: fromStatus,
            paymentStatus: order.paymentStatus,
          },
          after: {
            status: "REFUNDED",
            paymentStatus: "REFUNDED",
            provider: "MOCK",
          },
        },
      });

      await inventory.releaseOrder(tx, order.id);
      await reopenCustomerOrderCapacityIfNeeded(
        tx,
        order.pickupEventId,
        order.pickupEvent,
      );

      cancellationNotice = {
        orderCode: order.orderCode,
        comboQuantity: order.comboQuantity,
        totalCents: order.totalCents,
        currency: order.currency,
        locationLabel: order.pickupEvent.locationLabel,
        refundStatus: "REFUNDED",
      };

      return {
        orderCode: order.orderCode,
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        refundStatus: "REFUNDED",
        alreadyCancelled: false,
      };
    }

    if (
      (paidPayment.provider !== "MERCADOPAGO" &&
        paidPayment.provider !== "STRIPE") ||
      !paidPayment.externalId
    ) {
      throw new ConflictException(
        "El pago real no tiene una referencia externa válida para procesar el reembolso.",
      );
    }

    const refundMetadata = withRefundMetadata(
      paidPayment.metadata,
      now,
      "requested",
    );

    await tx.payment.update({
      where: { id: paidPayment.id },
      data: {
        metadata: refundMetadata,
      },
    });

    refundRequest = {
      paymentId: paidPayment.id,
      orderId: order.id,
      orderCode: order.orderCode,
      provider: paidPayment.provider,
      externalId: paidPayment.externalId,
      amountCents: paidPayment.amountCents,
      metadata: refundMetadata,
    };

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
        note:
          "Pedido cancelado por el cliente; reembolso solicitado al proveedor.",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CUSTOMER_REFUND_REQUESTED",
        entityType: "Order",
        entityId: order.id,
        before: {
          status: fromStatus,
          paymentStatus: order.paymentStatus,
        },
        after: {
          status: "CANCELLED",
          paymentStatus: order.paymentStatus,
          provider: paidPayment.provider,
          refundStatus: "PENDING",
        },
      },
    });

    await inventory.releaseOrder(tx, order.id);
    await reopenCustomerOrderCapacityIfNeeded(
      tx,
      order.pickupEventId,
      order.pickupEvent,
    );

    cancellationNotice = {
      orderCode: order.orderCode,
      comboQuantity: order.comboQuantity,
      totalCents: order.totalCents,
      currency: order.currency,
      locationLabel: order.pickupEvent.locationLabel,
      refundStatus: "PENDING",
    };

    return {
      orderCode: order.orderCode,
      status: "CANCELLED",
      paymentStatus: order.paymentStatus,
      refundStatus: "PENDING",
      alreadyCancelled: false,
    };
  });

  return {
    result,
    cancellationNotice,
    refundRequest,
  };
}
