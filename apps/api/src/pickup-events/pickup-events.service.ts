import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

@Injectable()
export class PickupEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent() {
    const now = new Date();

    const event = await this.prisma.pickupEvent.findFirst({
      where: {
        status: { in: ["OPEN", "SOLD_OUT"] },
        closesAt: { gt: now },
      },
      orderBy: { startsAt: "asc" },
    });

    if (!event) {
      throw new NotFoundException("No hay un evento de entrega abierto.");
    }

    const capacity = await this.prisma.order.aggregate({
      where: {
        pickupEventId: event.id,
        OR: [
          { status: { in: [...CAPACITY_STATUSES] } },
          {
            status: "PENDING_PAYMENT",
            reservationExpiresAt: { gt: now },
          },
        ],
      },
      _sum: { comboQuantity: true },
    });

    const reservedCombos = capacity._sum.comboQuantity ?? 0;
    const soldOut = reservedCombos >= event.maxCombos;

    if (event.status === "SOLD_OUT" && !soldOut) {
      await this.prisma.pickupEvent.update({
        where: { id: event.id },
        data: { status: "OPEN" },
      });
    } else if (event.status === "OPEN" && soldOut) {
      await this.prisma.pickupEvent.update({
        where: { id: event.id },
        data: { status: "SOLD_OUT" },
      });
    }

    return {
      id: event.id,
      code: event.code,
      name: event.name,
      locationLabel: event.locationLabel,
      timezone: event.timezone,
      startsAt: event.startsAt,
      closesAt: event.closesAt,
      maxCombos: event.maxCombos,
      reservedCombos,
      remainingCombos: Math.max(0, event.maxCombos - reservedCombos),
      status: soldOut ? "SOLD_OUT" : "OPEN",
    };
  }
}
