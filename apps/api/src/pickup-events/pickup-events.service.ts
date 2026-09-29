import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

const GROUP_EXCLUDED_STATUSES = [
  "CANCELLED",
  "REFUNDED",
] as const;

@Injectable()
export class PickupEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOpen() {
    const now = new Date();

    const events = await this.prisma.pickupEvent.findMany({
      where: {
        status: { in: ["OPEN", "SOLD_OUT"] },
        closesAt: { gt: now },
        pickupPoint: {
          active: true,
        },
      },
      include: {
        pickupPoint: true,
        orders: {
          select: {
            status: true,
            paymentStatus: true,
            comboQuantity: true,
            reservationExpiresAt: true,
          },
        },
      },
      orderBy: [
        { startsAt: "asc" },
        { pickupPoint: { name: "asc" } },
      ],
      take: 50,
    });

    const normalized = await Promise.all(
      events.map(async (event) => {
        const reservedCombos = event.orders
          .filter(
            (order) =>
              CAPACITY_STATUSES.includes(
                order.status as (typeof CAPACITY_STATUSES)[number],
              ) ||
              (order.status === "PENDING_PAYMENT" &&
                !!order.reservationExpiresAt &&
                order.reservationExpiresAt > now),
          )
          .reduce(
            (sum, order) => sum + order.comboQuantity,
            0,
          );

        const soldOut =
          reservedCombos >= event.maxCombos;

        const nextStatus = soldOut
          ? "SOLD_OUT"
          : "OPEN";

        if (nextStatus !== event.status) {
          await this.prisma.pickupEvent.update({
            where: { id: event.id },
            data: { status: nextStatus },
          });
        }

        const paidOrderCount = event.orders.filter(
          (order) =>
            order.paymentStatus === "PAID" &&
            !GROUP_EXCLUDED_STATUSES.includes(
              order.status as (typeof GROUP_EXCLUDED_STATUSES)[number],
            ),
        ).length;

        const freeDeliveryUnlocked =
          paidOrderCount >=
          event.freeDeliveryMinPaidCombos;

        const estimatedDeliveryFeeCents =
          freeDeliveryUnlocked
            ? 0
            : paidOrderCount > 0
              ? Math.ceil(
                  event.transportCostCents /
                    paidOrderCount,
                )
              : null;

        return {
          id: event.id,
          code: event.code,
          name: event.name,
          locationLabel: event.locationLabel,
          pickupPoint: {
            id: event.pickupPoint.id,
            code: event.pickupPoint.code,
            name: event.pickupPoint.name,
            address: event.pickupPoint.address,
            latitude: event.pickupPoint.latitude,
            longitude: event.pickupPoint.longitude,
          },
          timezone: event.timezone,
          startsAt: event.startsAt,
          closesAt: event.closesAt,
          maxCombos: event.maxCombos,
          reservedCombos,
          remainingCombos: Math.max(
            0,
            event.maxCombos - reservedCombos,
          ),
          status: nextStatus,
          groupDelivery: {
            minPaidOrders:
              event.freeDeliveryMinPaidCombos,
            paidOrderCount,
            remainingPaidOrders: Math.max(
              0,
              event.freeDeliveryMinPaidCombos -
                paidOrderCount,
            ),
            transportCostCents:
              event.transportCostCents,
            estimatedDeliveryFeeCents,
            freeDeliveryUnlocked,
          },
        };
      }),
    );

    return normalized;
  }

  async getCurrent() {
    const events = await this.getOpen();
    const event = events[0];

    if (!event) {
      throw new NotFoundException(
        "No hay un evento de entrega abierto.",
      );
    }

    return event;
  }
}
