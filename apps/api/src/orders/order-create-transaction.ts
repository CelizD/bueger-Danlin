import {
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaService } from "../database/prisma.service.js";
import type { InventoryService } from "../inventory/inventory.service.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";
import { prepareOrderItems } from "./order-create-items.js";
import type { NormalizedCreateOrderRequest } from "./order-create-request.js";
import {
  createOrderVerificationToken,
  hashOrderVerificationToken,
} from "./order-create-security.js";

const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

const RESERVATION_MINUTES = 15;
const GROUP_DELIVERY_TERMS_VERSION = "2026-09-29-v2";

export async function createOrderTransaction(
  prisma: PrismaService,
  inventory: InventoryService,
  dto: CreateOrderDto,
  requestKey: string,
  requestHash: string,
  normalizedRequest: NormalizedCreateOrderRequest,
  qrSecret: string,
) {
  return prisma.$transaction(async (tx) => {
    const lockedRows =
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "PickupEvent"
        WHERE "id" = ${dto.pickupEventId}
        FOR UPDATE
      `;

    if (lockedRows.length === 0) {
      throw new NotFoundException(
        "El evento de entrega no existe.",
      );
    }

    const event = await tx.pickupEvent.findUnique({
      where: { id: dto.pickupEventId },
    });

    if (!event) {
      throw new NotFoundException(
        "El evento de entrega no existe.",
      );
    }

    const now = new Date();

    if (
      !["OPEN", "SOLD_OUT"].includes(event.status)
    ) {
      throw new ConflictException(
        "Este evento no está abierto para pedidos.",
      );
    }

    if (now >= event.closesAt) {
      throw new ConflictException(
        "Los pedidos para este evento ya están cerrados.",
      );
    }

    if (now >= event.startsAt) {
      throw new ConflictException(
        "Este evento de entrega ya comenzó.",
      );
    }

    const {
      preparedItems,
      comboQuantity,
      totalCents,
    } = await prepareOrderItems(tx, dto.items);

    const capacity = await tx.order.aggregate({
      where: {
        pickupEventId: event.id,
        OR: [
          {
            status: {
              in: [...CAPACITY_STATUSES],
            },
          },
          {
            status: "PENDING_PAYMENT",
            reservationExpiresAt: {
              gt: now,
            },
          },
        ],
      },
      _sum: {
        comboQuantity: true,
      },
    });

    const reservedCombos =
      capacity._sum.comboQuantity ?? 0;

    if (
      reservedCombos + comboQuantity >
      event.maxCombos
    ) {
      if (
        event.status !== "SOLD_OUT" &&
        reservedCombos >= event.maxCombos
      ) {
        await tx.pickupEvent.update({
          where: { id: event.id },
          data: { status: "SOLD_OUT" },
        });
      }

      const remaining = Math.max(
        0,
        event.maxCombos - reservedCombos,
      );

      throw new ConflictException(
        remaining === 0
          ? "Los combos de este sábado ya están agotados."
          : `Solo quedan ${remaining} combo(s) disponibles.`,
      );
    }

    if (
      event.status === "SOLD_OUT" &&
      reservedCombos < event.maxCombos
    ) {
      await tx.pickupEvent.update({
        where: { id: event.id },
        data: { status: "OPEN" },
      });
    }

    const groupDeliveryPaidOrders =
      await tx.order.findMany({
        where: {
          pickupEventId: event.id,
          paymentStatus: "PAID",
          status: {
            notIn: [
              "CANCELLED",
              "REFUNDED",
            ],
          },
        },
        select: {
          comboQuantity: true,
        },
      });
    const groupDeliveryPaidOrderCount =
      groupDeliveryPaidOrders.length;
    const groupDeliveryPaidCombos =
      groupDeliveryPaidOrders.reduce(
        (sum, paidOrder) =>
          sum + paidOrder.comboQuantity,
        0,
      );

    const groupDeliveryFreeUnlocked =
      groupDeliveryPaidCombos >=
      event.freeDeliveryMinPaidCombos;

    const groupDeliveryEstimatedFeeCents =
      groupDeliveryFreeUnlocked
        ? 0
        : groupDeliveryPaidOrderCount > 0
          ? Math.ceil(
              event.transportCostCents /
                groupDeliveryPaidOrderCount,
            )
          : null;

    const customer = await tx.customer.create({
      data: {
        name: normalizedRequest.customer.name,
        phone: normalizedRequest.customer.phone,
        email: normalizedRequest.customer.email,
      },
    });

    const orderId = randomUUID();
    const orderCode =
      `H-${randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;
    const verificationToken =
      createOrderVerificationToken(
        qrSecret,
        orderId,
      );
    const verificationTokenHash =
      hashOrderVerificationToken(
        verificationToken,
      );
    const reservationExpiresAt = new Date(
      now.getTime() +
        RESERVATION_MINUTES * 60_000,
    );

    const order = await tx.order.create({
      data: {
        id: orderId,
        orderCode,
        requestKey,
        requestHash,
        customerId: customer.id,
        pickupEventId: event.id,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        currency: "MXN",
        subtotalCents: totalCents,
        totalCents,
        comboQuantity,
        verificationTokenHash,
        reservationExpiresAt,
        groupDeliveryTermsAcceptedAt: now,
        groupDeliveryTermsVersion:
          GROUP_DELIVERY_TERMS_VERSION,
        groupDeliveryMinPaidCombosAtOrder:
          event.freeDeliveryMinPaidCombos,
        groupDeliveryTransportCostCentsAtOrder:
          event.transportCostCents,
        groupDeliveryPaidCombosAtOrder:
          groupDeliveryPaidCombos,
        groupDeliveryEstimatedFeeCentsAtOrder:
          groupDeliveryEstimatedFeeCents,
      },
    });

    await inventory.reserveForOrder(
      tx,
      order.id,
      preparedItems,
    );

    for (const item of preparedItems) {
      const orderItem =
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            unitPriceCents:
              item.unitPriceCents,
            quantity: item.quantity,
            lineTotalCents:
              item.lineTotalCents,
          },
        });

      if (item.modifiers.length > 0) {
        await tx.orderItemModifier.createMany({
          data: item.modifiers.map(
            (modifier) => ({
              orderItemId: orderItem.id,
              modifierOptionId:
                modifier.modifierOptionId,
              optionName:
                modifier.optionName,
              priceDeltaCents:
                modifier.priceDeltaCents,
              quantity:
                modifier.quantity,
              removed: modifier.removed,
            }),
          ),
        });
      }
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        from: null,
        to: "PENDING_PAYMENT",
        note:
          `Capacidad reservada por ${RESERVATION_MINUTES} minutos.`,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "ORDER_CREATED",
        entityType: "Order",
        entityId: order.id,
        after: {
          orderCode: order.orderCode,
          pickupEventId: event.id,
          status: order.status,
          paymentStatus:
            order.paymentStatus,
          comboQuantity:
            order.comboQuantity,
          totalCents: order.totalCents,
          currency: order.currency,
          groupDeliveryTermsVersion:
            GROUP_DELIVERY_TERMS_VERSION,
          groupDeliveryTermsAccepted:
            true,
        },
      },
    });

    if (
      reservedCombos + comboQuantity ===
      event.maxCombos
    ) {
      await tx.pickupEvent.update({
        where: { id: event.id },
        data: { status: "SOLD_OUT" },
      });
    }

    return {
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotalCents:
        order.subtotalCents,
      totalCents: order.totalCents,
      comboQuantity:
        order.comboQuantity,
      reservationExpiresAt:
        order.reservationExpiresAt,
      verificationToken,
      pickup: {
        eventId: event.id,
        eventCode: event.code,
        locationLabel:
          event.locationLabel,
        startsAt: event.startsAt,
        closesAt: event.closesAt,
        timezone: event.timezone,
      },
      groupDelivery: {
        minPaidCombos:
          event.freeDeliveryMinPaidCombos,
        paidComboCount:
          groupDeliveryPaidCombos,
        remainingPaidCombos:
          Math.max(
            0,
            event.freeDeliveryMinPaidCombos -
              groupDeliveryPaidCombos,
          ),
        transportCostCents:
          event.transportCostCents,
        estimatedDeliveryFeeCents:
          groupDeliveryEstimatedFeeCents,
        freeDeliveryUnlocked:
          groupDeliveryFreeUnlocked,
      },
    };
  });
}
