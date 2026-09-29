import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service.js";
import { CreatePickupEventDto } from "./dto/create-pickup-event.dto.js";
import { UpdatePickupEventDto } from "./dto/update-pickup-event.dto.js";
import { ensureAdminPickupPoint } from "./admin-pickup-point.js";
import {
  assertGroupDeliveryCapacity,
  assertPickupEventDates,
  assertPickupEventSaturday,
  buildPickupEventCode,
  CAPACITY_STATUSES,
  defaultPickupEventName,
} from "./admin-pickup-event-rules.js";

export async function createAdminPickupEvent(
  prisma: PrismaService,
  dto: CreatePickupEventDto,
  userId: string,
) {
  const startsAt = new Date(dto.startsAt);
  const closesAt = new Date(dto.closesAt);

  assertPickupEventDates(startsAt, closesAt);
  assertPickupEventSaturday(startsAt);

  if (startsAt <= new Date()) {
    throw new BadRequestException(
      "La fecha de entrega debe estar en el futuro.",
    );
  }

  assertGroupDeliveryCapacity(
    dto.maxCombos,
    dto.freeDeliveryMinPaidOrders ?? 5,
  );

  return prisma.$transaction(async (tx) => {
    const pickupPoint = await ensureAdminPickupPoint(tx, {
      locationLabel: dto.locationLabel,
      locationAddress: dto.locationAddress,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    const code = buildPickupEventCode(
      startsAt,
      pickupPoint.code,
    );

    const existing = await tx.pickupEvent.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        "Ya existe una entrega para este punto en esa fecha.",
      );
    }

    const created = await tx.pickupEvent.create({
      data: {
        code,
        name:
          dto.name?.trim() ||
          defaultPickupEventName(
            startsAt,
            pickupPoint.name,
          ),
        locationLabel: pickupPoint.name,
        pickupPointId: pickupPoint.id,
        timezone: "America/Tijuana",
        startsAt,
        closesAt,
        maxCombos: dto.maxCombos,
        freeDeliveryMinPaidOrders:
          dto.freeDeliveryMinPaidOrders ?? 5,
        transportCostCents:
          dto.transportCostCents ?? 0,
        status: "DRAFT",
      },
      include: {
        pickupPoint: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "PICKUP_EVENT_CREATED",
        entityType: "PickupEvent",
        entityId: created.id,
        after: {
          code: created.code,
          pickupPointId: created.pickupPointId,
          pickupPointCode: created.pickupPoint.code,
          locationLabel: created.locationLabel,
          startsAt: created.startsAt.toISOString(),
          closesAt: created.closesAt.toISOString(),
          maxCombos: created.maxCombos,
          freeDeliveryMinPaidOrders:
            created.freeDeliveryMinPaidOrders,
          transportCostCents:
            created.transportCostCents,
          status: created.status,
        },
      },
    });

    return created;
  });
}

export async function updateAdminPickupEvent(
  prisma: PrismaService,
  id: string,
  dto: UpdatePickupEventDto,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.pickupEvent.findUnique({
      where: { id },
      include: {
        pickupPoint: true,
      },
    });

    if (!event) {
      throw new NotFoundException(
        "La entrega no existe.",
      );
    }

    if (
      event.status === "COMPLETED" ||
      event.status === "CANCELLED" ||
      event.groupDeliveryFinalizedAt
    ) {
      throw new ConflictException(
        "Una entrega completada o cancelada ya no puede editarse.",
      );
    }

    const startsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : event.startsAt;
    const closesAt = dto.closesAt
      ? new Date(dto.closesAt)
      : event.closesAt;

    assertPickupEventDates(startsAt, closesAt);
    assertPickupEventSaturday(startsAt);

    const now = new Date();

    if (
      (event.status === "OPEN" ||
        event.status === "SOLD_OUT") &&
      (closesAt <= now || startsAt <= now)
    ) {
      throw new ConflictException(
        "Una entrega abierta debe mantener su cierre y entrega en el futuro.",
      );
    }

    const groupDeliveryTermsChanging =
      (dto.freeDeliveryMinPaidOrders !==
        undefined &&
        dto.freeDeliveryMinPaidOrders !==
          event.freeDeliveryMinPaidOrders) ||
      (dto.transportCostCents !==
        undefined &&
        dto.transportCostCents !==
          event.transportCostCents);

    if (groupDeliveryTermsChanging) {
      const existingOrderCount =
        await tx.order.count({
          where: {
            pickupEventId: id,
          },
        });

      if (existingOrderCount > 0) {
        throw new ConflictException(
          "La meta de envío gratis y el costo de traslado quedan bloqueados desde el primer pedido.",
        );
      }
    }

    const maxCombos =
      dto.maxCombos ?? event.maxCombos;
    const freeDeliveryMinPaidOrders =
      dto.freeDeliveryMinPaidOrders ??
      event.freeDeliveryMinPaidOrders;

    assertGroupDeliveryCapacity(
      maxCombos,
      freeDeliveryMinPaidOrders,
    );

    assertGroupDeliveryCapacity(
      event.maxCombos,
      event.freeDeliveryMinPaidOrders,
    );

    const capacity = await tx.order.aggregate({
      where: {
        pickupEventId: id,
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
    if (maxCombos < reservedCombos) {
      throw new ConflictException(
        "El límite no puede ser menor a los " +
          reservedCombos +
          " combo(s) ya reservados o pagados.",
      );
    }

    let pickupPoint = event.pickupPoint;

    if (
      dto.locationLabel !== undefined &&
      dto.locationLabel.trim() !==
        event.pickupPoint.name
    ) {
      pickupPoint = await ensureAdminPickupPoint(tx, {
        locationLabel: dto.locationLabel,
        locationAddress: dto.locationAddress,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
    } else if (
      dto.locationAddress !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined
    ) {
      pickupPoint = await tx.pickupPoint.update({
        where: {
          id: event.pickupPointId,
        },
        data: {
          address:
            dto.locationAddress !== undefined
              ? dto.locationAddress.trim() || null
              : undefined,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    }

    const code = buildPickupEventCode(
      startsAt,
      pickupPoint.code,
    );

    if (code !== event.code) {
      const conflict =
        await tx.pickupEvent.findUnique({
          where: { code },
          select: { id: true },
        });

      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          "Ya existe otra entrega para este punto en esa fecha.",
        );
      }
    }

    let nextStatus = event.status;

    if (
      event.status === "OPEN" &&
      reservedCombos >= maxCombos
    ) {
      nextStatus = "SOLD_OUT";
    } else if (
      event.status === "SOLD_OUT" &&
      reservedCombos < maxCombos
    ) {
      nextStatus = "OPEN";
    }

    const updated = await tx.pickupEvent.update({
      where: { id },
      data: {
        code,
        pickupPointId: pickupPoint.id,
        name:
          dto.name !== undefined
            ? dto.name.trim() ||
              defaultPickupEventName(
                startsAt,
                pickupPoint.name,
              )
            : dto.startsAt !== undefined ||
                pickupPoint.id !==
                  event.pickupPointId
              ? defaultPickupEventName(
                  startsAt,
                  pickupPoint.name,
                )
              : undefined,
        locationLabel: pickupPoint.name,
        startsAt:
          dto.startsAt !== undefined
            ? startsAt
            : undefined,
        closesAt:
          dto.closesAt !== undefined
            ? closesAt
            : undefined,
        maxCombos: dto.maxCombos,
        freeDeliveryMinPaidOrders:
          dto.freeDeliveryMinPaidOrders,
        transportCostCents:
          dto.transportCostCents,
        status: nextStatus,
      },
      include: {
        pickupPoint: true,
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
          pickupPointId: event.pickupPointId,
          locationLabel: event.locationLabel,
          startsAt: event.startsAt.toISOString(),
          closesAt: event.closesAt.toISOString(),
          maxCombos: event.maxCombos,
          freeDeliveryMinPaidOrders:
            event.freeDeliveryMinPaidOrders,
          transportCostCents:
            event.transportCostCents,
          status: event.status,
        },
        after: {
          code: updated.code,
          pickupPointId: updated.pickupPointId,
          locationLabel: updated.locationLabel,
          startsAt: updated.startsAt.toISOString(),
          closesAt: updated.closesAt.toISOString(),
          maxCombos: updated.maxCombos,
          freeDeliveryMinPaidOrders:
            updated.freeDeliveryMinPaidOrders,
          transportCostCents:
            updated.transportCostCents,
          status: updated.status,
        },
      },
    });

    return updated;
  });
}

export async function openAdminPickupEvent(
  prisma: PrismaService,
  id: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.pickupEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(
        "La entrega no existe.",
      );
    }

    if (
      event.status === "COMPLETED" ||
      event.status === "CANCELLED" ||
      event.groupDeliveryFinalizedAt
    ) {
      throw new ConflictException(
        "Esta entrega ya no puede volver a abrirse.",
      );
    }

    const now = new Date();

    if (
      event.closesAt <= now ||
      event.startsAt <= now
    ) {
      throw new ConflictException(
        "No puedes abrir una entrega cuya fecha de cierre o entrega ya pasó.",
      );
    }

    const capacity = await tx.order.aggregate({
      where: {
        pickupEventId: id,
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

    const nextStatus =
      reservedCombos >= event.maxCombos
        ? "SOLD_OUT"
        : "OPEN";

    const updated = await tx.pickupEvent.update({
      where: { id },
      data: {
        status: nextStatus,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "PICKUP_EVENT_OPENED",
        entityType: "PickupEvent",
        entityId: id,
        before: {
          status: event.status,
        },
        after: {
          status: updated.status,
        },
      },
    });

    return updated;
  });
}
