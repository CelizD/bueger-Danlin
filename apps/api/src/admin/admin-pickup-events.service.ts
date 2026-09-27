import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { GroupDeliverySettlementService } from "../group-delivery/group-delivery-settlement.service.js";
import { CreatePickupEventDto } from "./dto/create-pickup-event.dto.js";
import { UpdatePickupEventDto } from "./dto/update-pickup-event.dto.js";

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

type PickupPointInput = {
  locationLabel: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
};

@Injectable()
export class AdminPickupEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupDeliverySettlement: GroupDeliverySettlementService,
  ) {}

  async list() {
    const now = new Date();

    await this.groupDeliverySettlement.settleExpired(now);

    const events = await this.prisma.pickupEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 80,
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
    });

    return Promise.all(
      events.map(async (event) => {
        const paidCombos = event.orders
          .filter((order) =>
            CAPACITY_STATUSES.includes(
              order.status as (typeof CAPACITY_STATUSES)[number],
            ),
          )
          .reduce(
            (sum, order) => sum + order.comboQuantity,
            0,
          );

        const pendingReservedCombos = event.orders
          .filter(
            (order) =>
              order.status === "PENDING_PAYMENT" &&
              !!order.reservationExpiresAt &&
              order.reservationExpiresAt > now,
          )
          .reduce(
            (sum, order) => sum + order.comboQuantity,
            0,
          );

        const reservedCombos =
          paidCombos + pendingReservedCombos;

        const paidOrderCount = event.orders.filter(
          (order) =>
            order.paymentStatus === "PAID" &&
            !GROUP_EXCLUDED_STATUSES.includes(
              order.status as (typeof GROUP_EXCLUDED_STATUSES)[number],
            ),
        ).length;

        const freeDeliveryUnlocked =
          paidOrderCount >=
          event.freeDeliveryMinPaidOrders;

        const estimatedDeliveryFeeCents =
          freeDeliveryUnlocked
            ? 0
            : paidOrderCount > 0
              ? Math.ceil(
                  event.transportCostCents /
                    paidOrderCount,
                )
              : null;

        let normalizedStatus = event.status;

        if (
          event.status === "OPEN" ||
          event.status === "SOLD_OUT"
        ) {
          if (event.closesAt <= now) {
            normalizedStatus = "CLOSED";
          } else if (
            reservedCombos >= event.maxCombos
          ) {
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
          pickupPoint: {
            id: event.pickupPoint.id,
            code: event.pickupPoint.code,
            name: event.pickupPoint.name,
            address: event.pickupPoint.address,
            latitude: event.pickupPoint.latitude,
            longitude: event.pickupPoint.longitude,
            active: event.pickupPoint.active,
          },
          timezone: event.timezone,
          startsAt: event.startsAt,
          closesAt: event.closesAt,
          maxCombos: event.maxCombos,
          status: normalizedStatus,
          paidCombos,
          pendingReservedCombos,
          reservedCombos,
          remainingCombos: Math.max(
            0,
            event.maxCombos - reservedCombos,
          ),
          orderCount: event.orders.length,
          groupDelivery: {
            minPaidOrders:
              event.freeDeliveryMinPaidOrders,
            paidOrderCount,
            remainingPaidOrders: Math.max(
              0,
              event.freeDeliveryMinPaidOrders -
                paidOrderCount,
            ),
            transportCostCents:
              event.transportCostCents,
            estimatedDeliveryFeeCents:
              event.groupDeliveryFinalizedAt &&
              event.groupDeliveryFinalAssignedCents != null &&
              event.groupDeliveryFinalPaidOrders &&
              event.groupDeliveryFinalPaidOrders > 0
                ? Math.ceil(
                    event.groupDeliveryFinalAssignedCents /
                      event.groupDeliveryFinalPaidOrders,
                  )
                : estimatedDeliveryFeeCents,
            freeDeliveryUnlocked:
              event.groupDeliveryFinalizedAt
                ? event.groupDeliveryFinalFreeUnlocked ?? false
                : freeDeliveryUnlocked,
            finalized: !!event.groupDeliveryFinalizedAt,
            finalizedAt: event.groupDeliveryFinalizedAt,
            finalPaidOrderCount:
              event.groupDeliveryFinalPaidOrders,
            finalTransportCostCents:
              event.groupDeliveryFinalTransportCostCents,
            finalAssignedCents:
              event.groupDeliveryFinalAssignedCents,
          },
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        };
      }),
    );
  }

  async create(
    dto: CreatePickupEventDto,
    userId: string,
  ) {
    const startsAt = new Date(dto.startsAt);
    const closesAt = new Date(dto.closesAt);

    this.assertDates(startsAt, closesAt);
    this.assertSaturday(startsAt);

    if (startsAt <= new Date()) {
      throw new BadRequestException(
        "La fecha de entrega debe estar en el futuro.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const pickupPoint =
        await this.ensurePickupPoint(tx, {
          locationLabel: dto.locationLabel,
          locationAddress: dto.locationAddress,
          latitude: dto.latitude,
          longitude: dto.longitude,
        });

      const code = this.buildEventCode(
        startsAt,
        pickupPoint.code,
      );

      const existing =
        await tx.pickupEvent.findUnique({
          where: { code },
          select: { id: true },
        });

      if (existing) {
        throw new ConflictException(
          "Ya existe una entrega para este punto en esa fecha.",
        );
      }

      const created =
        await tx.pickupEvent.create({
          data: {
            code,
            name:
              dto.name?.trim() ||
              this.defaultName(
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
            pickupPointCode:
              created.pickupPoint.code,
            locationLabel:
              created.locationLabel,
            startsAt:
              created.startsAt.toISOString(),
            closesAt:
              created.closesAt.toISOString(),
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

  async update(
    id: string,
    dto: UpdatePickupEventDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event =
        await tx.pickupEvent.findUnique({
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

      this.assertDates(startsAt, closesAt);
      this.assertSaturday(startsAt);

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

      const capacity =
        await tx.order.aggregate({
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
      const maxCombos =
        dto.maxCombos ?? event.maxCombos;

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
        pickupPoint =
          await this.ensurePickupPoint(tx, {
            locationLabel: dto.locationLabel,
            locationAddress:
              dto.locationAddress,
            latitude: dto.latitude,
            longitude: dto.longitude,
          });
      } else if (
        dto.locationAddress !== undefined ||
        dto.latitude !== undefined ||
        dto.longitude !== undefined
      ) {
        pickupPoint =
          await tx.pickupPoint.update({
            where: {
              id: event.pickupPointId,
            },
            data: {
              address:
                dto.locationAddress !==
                undefined
                  ? dto.locationAddress.trim() ||
                    null
                  : undefined,
              latitude: dto.latitude,
              longitude: dto.longitude,
            },
          });
      }

      const code = this.buildEventCode(
        startsAt,
        pickupPoint.code,
      );

      if (code !== event.code) {
        const conflict =
          await tx.pickupEvent.findUnique({
            where: { code },
            select: { id: true },
          });

        if (
          conflict &&
          conflict.id !== id
        ) {
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

      const updated =
        await tx.pickupEvent.update({
          where: { id },
          data: {
            code,
            pickupPointId: pickupPoint.id,
            name:
              dto.name !== undefined
                ? dto.name.trim() ||
                  this.defaultName(
                    startsAt,
                    pickupPoint.name,
                  )
                : dto.startsAt !== undefined ||
                    pickupPoint.id !==
                      event.pickupPointId
                  ? this.defaultName(
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
            pickupPointId:
              event.pickupPointId,
            locationLabel:
              event.locationLabel,
            startsAt:
              event.startsAt.toISOString(),
            closesAt:
              event.closesAt.toISOString(),
            maxCombos: event.maxCombos,
            freeDeliveryMinPaidOrders:
              event.freeDeliveryMinPaidOrders,
            transportCostCents:
              event.transportCostCents,
            status: event.status,
          },
          after: {
            code: updated.code,
            pickupPointId:
              updated.pickupPointId,
            locationLabel:
              updated.locationLabel,
            startsAt:
              updated.startsAt.toISOString(),
            closesAt:
              updated.closesAt.toISOString(),
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

  async open(id: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const event =
          await tx.pickupEvent.findUnique({
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

        const capacity =
          await tx.order.aggregate({
            where: {
              pickupEventId: id,
              OR: [
                {
                  status: {
                    in: [
                      ...CAPACITY_STATUSES,
                    ],
                  },
                },
                {
                  status:
                    "PENDING_PAYMENT",
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
          reservedCombos >=
          event.maxCombos
            ? "SOLD_OUT"
            : "OPEN";

        const updated =
          await tx.pickupEvent.update({
            where: { id },
            data: {
              status: nextStatus,
            },
          });

        await tx.auditLog.create({
          data: {
            userId,
            action:
              "PICKUP_EVENT_OPENED",
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
      },
    );
  }

  async close(id: string, userId: string) {
    return this.groupDeliverySettlement.settleEvent(id, {
      force: true,
      actorUserId: userId,
      reason: "manual",
    });
  }

  private async ensurePickupPoint(
    db: any,
    input: PickupPointInput,
  ) {
    const name = input.locationLabel.trim();

    if (!name) {
      throw new BadRequestException(
        "El nombre del punto de entrega es obligatorio.",
      );
    }

    const code =
      this.buildPickupPointCode(name);

    const existing =
      await db.pickupPoint.findFirst({
        where: {
          OR: [
            { code },
            {
              name: {
                equals: name,
                mode: "insensitive",
              },
            },
          ],
        },
      });

    if (existing) {
      return db.pickupPoint.update({
        where: {
          id: existing.id,
        },
        data: {
          name,
          active: true,
          address:
            input.locationAddress !==
            undefined
              ? input.locationAddress.trim() ||
                null
              : undefined,
          latitude: input.latitude,
          longitude: input.longitude,
        },
      });
    }

    return db.pickupPoint.create({
      data: {
        code,
        name,
        address:
          input.locationAddress?.trim() ||
          null,
        latitude: input.latitude,
        longitude: input.longitude,
        active: true,
      },
    });
  }

  private assertDates(
    startsAt: Date,
    closesAt: Date,
  ) {
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(closesAt.getTime())
    ) {
      throw new BadRequestException(
        "Las fechas no son válidas.",
      );
    }

    if (closesAt >= startsAt) {
      throw new BadRequestException(
        "El cierre de pedidos debe ser antes de la hora de entrega.",
      );
    }
  }

  private assertSaturday(startsAt: Date) {
    const weekday =
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Tijuana",
        weekday: "short",
      }).format(startsAt);

    if (weekday !== "Sat") {
      throw new BadRequestException(
        "La fecha de entrega debe ser un sábado.",
      );
    }
  }

  private buildPickupPointCode(
    name: string,
  ) {
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    if (!normalized) {
      throw new BadRequestException(
        "El nombre del punto no genera un código válido.",
      );
    }

    return normalized;
  }

  private buildEventCode(
    startsAt: Date,
    pickupPointCode: string,
  ) {
    const date =
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Tijuana",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(startsAt);

    return (
      "SAT-" +
      date +
      "-" +
      pickupPointCode
    );
  }

  private defaultName(
    startsAt: Date,
    pickupPointName: string,
  ) {
    const date =
      new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Tijuana",
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(startsAt);

    return (
      "Entrega " +
      pickupPointName +
      " · " +
      date
    );
  }
}
