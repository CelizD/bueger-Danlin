import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { CreatePickupEventDto } from "./dto/create-pickup-event.dto.js";
import { UpdatePickupEventDto } from "./dto/update-pickup-event.dto.js";

const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

@Injectable()
export class AdminPickupEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const now = new Date();

    const events = await this.prisma.pickupEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 40,
      include: {
        orders: {
          select: {
            status: true,
            comboQuantity: true,
            reservationExpiresAt: true,
          },
        },
      },
    });

    return Promise.all(events.map(async (event) => {
      const paidCombos = event.orders
        .filter((order) =>
          CAPACITY_STATUSES.includes(
            order.status as (typeof CAPACITY_STATUSES)[number],
          ),
        )
        .reduce((sum, order) => sum + order.comboQuantity, 0);

      const pendingReservedCombos = event.orders
        .filter(
          (order) =>
            order.status === "PENDING_PAYMENT" &&
            !!order.reservationExpiresAt &&
            order.reservationExpiresAt > now,
        )
        .reduce((sum, order) => sum + order.comboQuantity, 0);

      const reservedCombos = paidCombos + pendingReservedCombos;

      let normalizedStatus = event.status;

      if (event.status === "OPEN" || event.status === "SOLD_OUT") {
        if (event.closesAt <= now) {
          normalizedStatus = "CLOSED";
        } else if (reservedCombos >= event.maxCombos) {
          normalizedStatus = "SOLD_OUT";
        } else {
          normalizedStatus = "OPEN";
        }

        if (normalizedStatus !== event.status) {
          await this.prisma.pickupEvent.update({
            where: { id: event.id },
            data: { status: normalizedStatus },
          });
        }
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
        status: normalizedStatus,
        paidCombos,
        pendingReservedCombos,
        reservedCombos,
        remainingCombos: Math.max(0, event.maxCombos - reservedCombos),
        orderCount: event.orders.length,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      };
    }));
  }

  async create(dto: CreatePickupEventDto, userId: string) {
    const startsAt = new Date(dto.startsAt);
    const closesAt = new Date(dto.closesAt);

    this.assertDates(startsAt, closesAt);
    this.assertSaturday(startsAt);

    if (startsAt <= new Date()) {
      throw new BadRequestException(
        "La fecha de entrega debe estar en el futuro.",
      );
    }

    const code = this.buildEventCode(startsAt);

    const existing = await this.prisma.pickupEvent.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        "Ya existe una entrega para esa fecha. Edita la existente.",
      );
    }

    const created = await this.prisma.pickupEvent.create({
      data: {
        code,
        name: dto.name?.trim() || this.defaultName(startsAt),
        locationLabel: dto.locationLabel.trim(),
        timezone: "America/Tijuana",
        startsAt,
        closesAt,
        maxCombos: dto.maxCombos,
        status: "DRAFT",
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "PICKUP_EVENT_CREATED",
        entityType: "PickupEvent",
        entityId: created.id,
        after: {
          code: created.code,
          locationLabel: created.locationLabel,
          startsAt: created.startsAt.toISOString(),
          closesAt: created.closesAt.toISOString(),
          maxCombos: created.maxCombos,
          status: created.status,
        },
      },
    });

    return created;
  }

  async update(id: string, dto: UpdatePickupEventDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.pickupEvent.findUnique({
        where: { id },
      });

      if (!event) {
        throw new NotFoundException("La entrega no existe.");
      }

      if (event.status === "COMPLETED" || event.status === "CANCELLED") {
        throw new ConflictException(
          "Una entrega completada o cancelada ya no puede editarse.",
        );
      }

      const startsAt = dto.startsAt ? new Date(dto.startsAt) : event.startsAt;
      const closesAt = dto.closesAt ? new Date(dto.closesAt) : event.closesAt;

      this.assertDates(startsAt, closesAt);
      this.assertSaturday(startsAt);

      const now = new Date();

      if (
        (event.status === "OPEN" || event.status === "SOLD_OUT") &&
        (closesAt <= now || startsAt <= now)
      ) {
        throw new ConflictException(
          "Una entrega abierta debe mantener su cierre y entrega en el futuro.",
        );
      }

      const capacity = await tx.order.aggregate({
        where: {
          pickupEventId: id,
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
      const maxCombos = dto.maxCombos ?? event.maxCombos;

      if (maxCombos < reservedCombos) {
        throw new ConflictException(
          "El límite no puede ser menor a los " +
            reservedCombos +
            " combo(s) ya reservados o pagados.",
        );
      }

      let code = event.code;

      if (dto.startsAt) {
        code = this.buildEventCode(startsAt);

        const conflict = await tx.pickupEvent.findUnique({
          where: { code },
          select: { id: true },
        });

        if (conflict && conflict.id !== id) {
          throw new ConflictException(
            "Ya existe otra entrega para esa fecha.",
          );
        }
      }

      let nextStatus = event.status;

      if (event.status === "OPEN" && reservedCombos >= maxCombos) {
        nextStatus = "SOLD_OUT";
      } else if (event.status === "SOLD_OUT" && reservedCombos < maxCombos) {
        nextStatus = "OPEN";
      }

      const updated = await tx.pickupEvent.update({
        where: { id },
        data: {
          code,
          name:
            dto.name !== undefined
              ? dto.name.trim() || this.defaultName(startsAt)
              : dto.startsAt
                ? this.defaultName(startsAt)
                : undefined,
          locationLabel:
            dto.locationLabel !== undefined
              ? dto.locationLabel.trim()
              : undefined,
          startsAt: dto.startsAt !== undefined ? startsAt : undefined,
          closesAt: dto.closesAt !== undefined ? closesAt : undefined,
          maxCombos: dto.maxCombos,
          status: nextStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PICKUP_EVENT_UPDATED",
          entityType: "PickupEvent",
          entityId: id,
          before: {
            code: event.code,
            locationLabel: event.locationLabel,
            startsAt: event.startsAt.toISOString(),
            closesAt: event.closesAt.toISOString(),
            maxCombos: event.maxCombos,
            status: event.status,
          },
          after: {
            code: updated.code,
            locationLabel: updated.locationLabel,
            startsAt: updated.startsAt.toISOString(),
            closesAt: updated.closesAt.toISOString(),
            maxCombos: updated.maxCombos,
            status: updated.status,
          },
        },
      });

      return updated;
    });
  }

  async open(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.pickupEvent.findUnique({
        where: { id },
      });

      if (!event) {
        throw new NotFoundException("La entrega no existe.");
      }

      if (event.status === "COMPLETED" || event.status === "CANCELLED") {
        throw new ConflictException(
          "Esta entrega ya no puede volver a abrirse.",
        );
      }

      const now = new Date();

      if (event.closesAt <= now || event.startsAt <= now) {
        throw new ConflictException(
          "No puedes abrir una entrega cuya fecha de cierre o entrega ya pasó.",
        );
      }

      const capacity = await tx.order.aggregate({
        where: {
          pickupEventId: id,
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

      await tx.pickupEvent.updateMany({
        where: {
          id: { not: id },
          status: { in: ["OPEN", "SOLD_OUT"] },
        },
        data: { status: "CLOSED" },
      });

      const nextStatus =
        reservedCombos >= event.maxCombos ? "SOLD_OUT" : "OPEN";

      const updated = await tx.pickupEvent.update({
        where: { id },
        data: { status: nextStatus },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PICKUP_EVENT_OPENED",
          entityType: "PickupEvent",
          entityId: id,
          before: { status: event.status },
          after: { status: updated.status },
        },
      });

      return updated;
    });
  }

  async close(id: string, userId: string) {
    const event = await this.prisma.pickupEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException("La entrega no existe.");
    }

    if (event.status === "COMPLETED" || event.status === "CANCELLED") {
      throw new ConflictException(
        "Esta entrega ya no puede cambiarse de estado.",
      );
    }

    const updated = await this.prisma.pickupEvent.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: "PICKUP_EVENT_CLOSED",
        entityType: "PickupEvent",
        entityId: id,
        before: { status: event.status },
        after: { status: "CLOSED" },
      },
    });

    return updated;
  }

  private assertDates(startsAt: Date, closesAt: Date) {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(closesAt.getTime())) {
      throw new BadRequestException("Las fechas no son válidas.");
    }

    if (closesAt >= startsAt) {
      throw new BadRequestException(
        "El cierre de pedidos debe ser antes de la hora de entrega.",
      );
    }
  }

  private assertSaturday(startsAt: Date) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Tijuana",
      weekday: "short",
    }).format(startsAt);

    if (weekday !== "Sat") {
      throw new BadRequestException(
        "La fecha de entrega debe ser un sábado.",
      );
    }
  }

  private buildEventCode(startsAt: Date) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Tijuana",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(startsAt);

    return "SAT-" + date;
  }

  private defaultName(startsAt: Date) {
    const date = new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Tijuana",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(startsAt);

    return "Entrega " + date;
  }
}
