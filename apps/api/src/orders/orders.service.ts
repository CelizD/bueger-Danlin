import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";

const CAPACITY_STATUSES = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
] as const;

const RESERVATION_MINUTES = 15;

@Injectable()
export class OrdersService {
  private readonly qrSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {
    const secret = process.env.QR_TOKEN_SECRET;

    if (!secret) {
      throw new Error("QR_TOKEN_SECRET is required");
    }

    this.qrSecret = secret;
  }

  async create(dto: CreateOrderDto, idempotencyKey: string) {
    const requestKey = idempotencyKey.trim();

    if (requestKey.length < 16 || requestKey.length > 128) {
      throw new BadRequestException(
        "Idempotency-Key debe tener entre 16 y 128 caracteres.",
      );
    }

    const normalizedRequest = {
      pickupEventId: dto.pickupEventId,
      customer: {
        name: dto.customer.name.trim(),
        phone: dto.customer.phone,
        email: dto.customer.email?.trim().toLowerCase() ?? null,
      },
      items: dto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        removedModifierOptionIds: [
          ...(item.removedModifierOptionIds ?? []),
        ].sort(),
        extraModifierOptionIds: [
          ...(item.extraModifierOptionIds ?? []),
        ].sort(),
      })),
    };

    const requestHash = createHash("sha256")
      .update(JSON.stringify(normalizedRequest))
      .digest("hex");

    const replay = await this.prisma.order.findUnique({
      where: { requestKey },
      include: { pickupEvent: true },
    });

    if (replay) {
      if (replay.requestHash !== requestHash) {
        throw new ConflictException(
          "La misma Idempotency-Key ya fue usada con otro pedido.",
        );
      }

      return this.presentOrder(replay);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "PickupEvent"
          WHERE "id" = ${dto.pickupEventId}
          FOR UPDATE
        `;

        if (lockedRows.length === 0) {
          throw new NotFoundException("El evento de entrega no existe.");
        }

        const event = await tx.pickupEvent.findUnique({
          where: { id: dto.pickupEventId },
        });

        if (!event) {
          throw new NotFoundException("El evento de entrega no existe.");
        }

        const now = new Date();

        if (!["OPEN", "SOLD_OUT"].includes(event.status)) {
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
          throw new ConflictException("Este evento de entrega ya comenzó.");
        }

        const productIds = [...new Set(dto.items.map((item) => item.productId))];

        const products = await tx.product.findMany({
          where: {
            id: { in: productIds },
            active: true,
          },
          include: {
            modifierGroups: {
              include: {
                modifierGroup: {
                  include: {
                    options: {
                      where: { active: true },
                      orderBy: { sortOrder: "asc" },
                    },
                  },
                },
              },
            },
          },
        });

        const productById = new Map(
          products.map((product) => [product.id, product]),
        );

        const preparedItems: Array<{
          productId: string;
          productName: string;
          unitPriceCents: number;
          quantity: number;
          lineTotalCents: number;
          modifiers: Array<{
            modifierOptionId: string;
            optionName: string;
            priceDeltaCents: number;
            quantity: number;
            removed: boolean;
          }>;
        }> = [];

        let comboQuantity = 0;
        let totalCents = 0;

        for (const item of dto.items) {
          const product = productById.get(item.productId);

          if (!product) {
            throw new BadRequestException(
              `Producto no disponible: ${item.productId}`,
            );
          }

          if (product.type === "COMBO" && item.quantity !== 1) {
            throw new BadRequestException(
              "Cada combo debe enviarse como un item separado para poder personalizar cada hamburguesa.",
            );
          }

          const removedIds = item.removedModifierOptionIds ?? [];
          const extraIds = item.extraModifierOptionIds ?? [];

          if (new Set(removedIds).size !== removedIds.length) {
            throw new BadRequestException(
              "Hay ingredientes removidos duplicados en un item.",
            );
          }

          if (new Set(extraIds).size !== extraIds.length) {
            throw new BadRequestException(
              "Hay extras duplicados en un item.",
            );
          }

          const availableOptions = product.modifierGroups
            .filter((link) => link.modifierGroup.active)
            .flatMap((link) => link.modifierGroup.options);

          const optionById = new Map(
            availableOptions.map((option) => [option.id, option]),
          );

          const modifiers: Array<{
            modifierOptionId: string;
            optionName: string;
            priceDeltaCents: number;
            quantity: number;
            removed: boolean;
          }> = [];

          for (const optionId of removedIds) {
            const option = optionById.get(optionId);

            if (!option || option.kind !== "REMOVABLE") {
              throw new BadRequestException(
                "Uno de los ingredientes a quitar no pertenece a este producto.",
              );
            }

            modifiers.push({
              modifierOptionId: option.id,
              optionName: option.name,
              priceDeltaCents: 0,
              quantity: item.quantity,
              removed: true,
            });
          }

          let extrasCents = 0;

          for (const optionId of extraIds) {
            const option = optionById.get(optionId);

            if (!option || option.kind !== "EXTRA") {
              throw new BadRequestException(
                "Uno de los extras no pertenece a este producto.",
              );
            }

            extrasCents += option.priceDeltaCents;

            modifiers.push({
              modifierOptionId: option.id,
              optionName: option.name,
              priceDeltaCents: option.priceDeltaCents,
              quantity: item.quantity,
              removed: false,
            });
          }

          if (product.type === "COMBO") {
            comboQuantity += item.quantity;
          }

          const lineTotalCents =
            product.priceCents * item.quantity +
            extrasCents * item.quantity;

          totalCents += lineTotalCents;

          preparedItems.push({
            productId: product.id,
            productName: product.name,
            unitPriceCents: product.priceCents,
            quantity: item.quantity,
            lineTotalCents,
            modifiers,
          });
        }

        if (comboQuantity < 1) {
          throw new BadRequestException(
            "El pedido debe contener al menos un combo.",
          );
        }

        const capacity = await tx.order.aggregate({
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

        if (reservedCombos + comboQuantity > event.maxCombos) {
          if (event.status !== "SOLD_OUT" && reservedCombos >= event.maxCombos) {
            await tx.pickupEvent.update({
              where: { id: event.id },
              data: { status: "SOLD_OUT" },
            });
          }

          const remaining = Math.max(0, event.maxCombos - reservedCombos);
          throw new ConflictException(
            remaining === 0
              ? "Los combos de este sábado ya están agotados."
              : `Solo quedan ${remaining} combo(s) disponibles.`,
          );
        }

        if (event.status === "SOLD_OUT" && reservedCombos < event.maxCombos) {
          await tx.pickupEvent.update({
            where: { id: event.id },
            data: { status: "OPEN" },
          });
        }

        const customer = await tx.customer.create({
          data: {
            name: normalizedRequest.customer.name,
            phone: normalizedRequest.customer.phone,
            email: normalizedRequest.customer.email,
          },
        });

        const orderId = randomUUID();
        const orderCode = `H-${randomBytes(4).toString("hex").toUpperCase()}`;
        const verificationToken = this.createVerificationToken(orderId);
        const verificationTokenHash = createHash("sha256")
          .update(verificationToken)
          .digest("hex");
        const reservationExpiresAt = new Date(
          now.getTime() + RESERVATION_MINUTES * 60_000,
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
          },
        });

        await this.inventory.reserveForOrder(tx, order.id, preparedItems);

        for (const item of preparedItems) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              productName: item.productName,
              unitPriceCents: item.unitPriceCents,
              quantity: item.quantity,
              lineTotalCents: item.lineTotalCents,
            },
          });

          if (item.modifiers.length > 0) {
            await tx.orderItemModifier.createMany({
              data: item.modifiers.map((modifier) => ({
                orderItemId: orderItem.id,
                modifierOptionId: modifier.modifierOptionId,
                optionName: modifier.optionName,
                priceDeltaCents: modifier.priceDeltaCents,
                quantity: modifier.quantity,
                removed: modifier.removed,
              })),
            });
          }
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            from: null,
            to: "PENDING_PAYMENT",
            note: `Capacidad reservada por ${RESERVATION_MINUTES} minutos.`,
          },
        });

        if (reservedCombos + comboQuantity === event.maxCombos) {
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
          subtotalCents: order.subtotalCents,
          totalCents: order.totalCents,
          comboQuantity: order.comboQuantity,
          reservationExpiresAt: order.reservationExpiresAt,
          verificationToken,
          pickup: {
            eventId: event.id,
            eventCode: event.code,
            locationLabel: event.locationLabel,
            startsAt: event.startsAt,
            closesAt: event.closesAt,
            timezone: event.timezone,
          },
        };
      });
    } catch (error) {
      const code = (error as { code?: string }).code;

      if (code === "P2002") {
        const existing = await this.prisma.order.findUnique({
          where: { requestKey },
          include: { pickupEvent: true },
        });

        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException(
              "La misma Idempotency-Key ya fue usada con otro pedido.",
            );
          }

          return this.presentOrder(existing);
        }
      }

      throw error;
    }
  }

  private createVerificationToken(orderId: string) {
    return createHmac("sha256", this.qrSecret)
      .update(orderId)
      .digest("base64url");
  }

  private presentOrder(order: {
    id: string;
    orderCode: string;
    status: string;
    paymentStatus: string;
    currency: string;
    subtotalCents: number;
    totalCents: number;
    comboQuantity: number;
    reservationExpiresAt: Date | null;
    pickupEvent: {
      id: string;
      code: string;
      locationLabel: string;
      startsAt: Date;
      closesAt: Date;
      timezone: string;
    };
  }) {
    return {
      orderCode: order.orderCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      totalCents: order.totalCents,
      comboQuantity: order.comboQuantity,
      reservationExpiresAt: order.reservationExpiresAt,
      verificationToken: this.createVerificationToken(order.id),
      pickup: {
        eventId: order.pickupEvent.id,
        eventCode: order.pickupEvent.code,
        locationLabel: order.pickupEvent.locationLabel,
        startsAt: order.pickupEvent.startsAt,
        closesAt: order.pickupEvent.closesAt,
        timezone: order.pickupEvent.timezone,
      },
    };
  }
}
