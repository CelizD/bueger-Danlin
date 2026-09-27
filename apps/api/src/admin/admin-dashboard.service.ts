import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

const CANCELLED_STATUSES = ["CANCELLED", "REFUNDED"] as const;
const TO_PREPARE_STATUSES = ["PAID", "CONFIRMED", "PREPARING"] as const;

function isEffectiveSale(order: {
  status: string;
  paymentStatus: string;
}) {
  return (
    order.paymentStatus === "PAID" &&
    !CANCELLED_STATUSES.includes(
      order.status as (typeof CANCELLED_STATUSES)[number],
    )
  );
}

function localDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tijuana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(pickupEventId?: string) {
    const events = await this.prisma.pickupEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 30,
      select: {
        id: true,
        code: true,
        name: true,
        locationLabel: true,
        startsAt: true,
        closesAt: true,
        status: true,
        freeDeliveryMinPaidOrders: true,
        transportCostCents: true,
        groupDeliveryFinalizedAt: true,
        groupDeliveryFinalPaidOrders: true,
        groupDeliveryFinalTransportCostCents: true,
        groupDeliveryFinalAssignedCents: true,
        groupDeliveryFinalFreeUnlocked: true,
        pickupPoint: {
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
          },
        },
      },
    });

    const selectedEvent =
      pickupEventId != null
        ? events.find((event) => event.id === pickupEventId) ?? null
        : null;

    const now = new Date();
    const nextActiveEvent =
      [...events]
        .filter(
          (event) =>
            ["OPEN", "SOLD_OUT"].includes(event.status) &&
            event.closesAt > now,
        )
        .sort(
          (a, b) =>
            a.startsAt.getTime() - b.startsAt.getTime(),
        )[0] ?? null;

    const dayAnchor = selectedEvent ?? nextActiveEvent ?? events[0] ?? null;
    const dayKey = dayAnchor ? localDateKey(dayAnchor.startsAt) : null;
    const dayEvents =
      dayKey == null
        ? []
        : events.filter(
            (event) => localDateKey(event.startsAt) === dayKey,
          );

    const [orders, dayOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: pickupEventId ? { pickupEventId } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalCents: true,
          comboQuantity: true,
          createdAt: true,
          pickupEventId: true,
          pickupEvent: {
            select: {
              id: true,
              code: true,
              name: true,
              startsAt: true,
            },
          },
          items: {
            select: {
              productName: true,
              quantity: true,
              product: {
                select: {
                  slug: true,
                  type: true,
                },
              },
              modifiers: {
                select: {
                  optionName: true,
                  priceDeltaCents: true,
                  quantity: true,
                  removed: true,
                },
              },
            },
          },
        },
      }),
      dayEvents.length > 0
        ? this.prisma.order.findMany({
            where: {
              pickupEventId: {
                in: dayEvents.map((event) => event.id),
              },
            },
            orderBy: [{ pickupEventId: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              orderCode: true,
              status: true,
              paymentStatus: true,
              totalCents: true,
              comboQuantity: true,
              pickupEventId: true,
              groupDeliveryFinalFeeCents: true,
              customer: {
                select: {
                  name: true,
                  phone: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const effectiveSales = orders.filter(isEffectiveSale);

    const revenueCents = effectiveSales.reduce(
      (sum, order) => sum + order.totalCents,
      0,
    );
    const combosSold = effectiveSales.reduce(
      (sum, order) => sum + order.comboQuantity,
      0,
    );
    const averageTicketCents =
      effectiveSales.length > 0
        ? Math.round(revenueCents / effectiveSales.length)
        : 0;

    const cancelledOrders = orders.filter(
      (order) => order.status === "CANCELLED",
    ).length;
    const refundedOrders = orders.filter(
      (order) =>
        order.status === "REFUNDED" ||
        order.paymentStatus === "REFUNDED",
    ).length;
    const noShowOrders = orders.filter(
      (order) => order.status === "NO_SHOW",
    ).length;

    const extrasMap = new Map<
      string,
      { quantity: number; revenueCents: number }
    >();
    let cokesSold = 0;

    for (const order of effectiveSales) {
      for (const item of order.items) {
        if (item.product.slug === "coca-cola-lata") {
          cokesSold += item.quantity;
        }

        for (const modifier of item.modifiers) {
          if (modifier.removed || modifier.priceDeltaCents <= 0) continue;

          const current = extrasMap.get(modifier.optionName) ?? {
            quantity: 0,
            revenueCents: 0,
          };

          current.quantity += modifier.quantity;
          current.revenueCents +=
            modifier.priceDeltaCents * modifier.quantity;
          extrasMap.set(modifier.optionName, current);
        }
      }
    }

    const topExtras = [...extrasMap.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return b.revenueCents - a.revenueCents;
      })
      .slice(0, 8);

    const eventMap = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        startsAt: Date;
        revenueCents: number;
        combosSold: number;
        paidOrders: number;
      }
    >();

    for (const order of effectiveSales) {
      const existing = eventMap.get(order.pickupEventId) ?? {
        id: order.pickupEvent.id,
        code: order.pickupEvent.code,
        name: order.pickupEvent.name,
        startsAt: order.pickupEvent.startsAt,
        revenueCents: 0,
        combosSold: 0,
        paidOrders: 0,
      };

      existing.revenueCents += order.totalCents;
      existing.combosSold += order.comboQuantity;
      existing.paidOrders += 1;
      eventMap.set(order.pickupEventId, existing);
    }

    const salesByEvent = [...eventMap.values()]
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, 8);

    const activeDayOrders = dayOrders.filter(
      (order) =>
        !CANCELLED_STATUSES.includes(
          order.status as (typeof CANCELLED_STATUSES)[number],
        ),
    );
    const paidDayOrders = dayOrders.filter(isEffectiveSale);

    const dayGroups = dayEvents.map((event) => {
      const eventOrders = dayOrders.filter(
        (order) => order.pickupEventId === event.id,
      );
      const activeOrders = eventOrders.filter(
        (order) =>
          !CANCELLED_STATUSES.includes(
            order.status as (typeof CANCELLED_STATUSES)[number],
          ),
      );
      const paidOrders = eventOrders.filter(isEffectiveSale);
      const finalized = !!event.groupDeliveryFinalizedAt;
      const paidOrderCount = finalized
        ? event.groupDeliveryFinalPaidOrders ?? paidOrders.length
        : paidOrders.length;
      const freeDeliveryUnlocked = finalized
        ? event.groupDeliveryFinalFreeUnlocked ?? false
        : paidOrderCount >= event.freeDeliveryMinPaidOrders;
      const estimatedFeeCents = finalized
        ? null
        : freeDeliveryUnlocked
          ? 0
          : paidOrderCount > 0
            ? Math.ceil(
                event.transportCostCents / paidOrderCount,
              )
            : null;

      return {
        eventId: event.id,
        eventCode: event.code,
        status: event.status,
        startsAt: event.startsAt,
        closesAt: event.closesAt,
        pickupPoint: event.pickupPoint,
        activeOrders: activeOrders.length,
        paidOrders: paidOrderCount,
        combosPaid: paidOrders.reduce(
          (sum, order) => sum + order.comboQuantity,
          0,
        ),
        combosToPrepare: paidOrders
          .filter((order) =>
            TO_PREPARE_STATUSES.includes(
              order.status as (typeof TO_PREPARE_STATUSES)[number],
            ),
          )
          .reduce(
            (sum, order) => sum + order.comboQuantity,
            0,
          ),
        readyCombos: paidOrders
          .filter((order) => order.status === "READY")
          .reduce(
            (sum, order) => sum + order.comboQuantity,
            0,
          ),
        minPaidOrders: event.freeDeliveryMinPaidOrders,
        remainingPaidOrders: Math.max(
          0,
          event.freeDeliveryMinPaidOrders - paidOrderCount,
        ),
        transportCostCents: finalized
          ? event.groupDeliveryFinalTransportCostCents ??
            event.transportCostCents
          : event.transportCostCents,
        estimatedFeeCents,
        freeDeliveryUnlocked,
        finalized,
        finalizedAt: event.groupDeliveryFinalizedAt,
        cashToCollectCents: paidOrders.reduce(
          (sum, order) =>
            sum + (order.groupDeliveryFinalFeeCents ?? 0),
          0,
        ),
      };
    });

    const groupByEventId = new Map(
      dayGroups.map((group) => [group.eventId, group]),
    );

    const deliveryCharges = paidDayOrders.map((order) => {
      const group = groupByEventId.get(order.pickupEventId);
      const finalized = group?.finalized ?? false;
      const freeDeliveryUnlocked =
        group?.freeDeliveryUnlocked ?? false;

      return {
        orderId: order.id,
        orderCode: order.orderCode,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        pickupPointName:
          group?.pickupPoint.name ?? "Punto de entrega",
        finalized,
        freeDeliveryUnlocked,
        finalFeeCents: finalized
          ? order.groupDeliveryFinalFeeCents ?? 0
          : null,
        estimatedFeeCents: finalized
          ? null
          : group?.estimatedFeeCents ?? null,
      };
    });

    const day = dayAnchor
      ? {
          date: dayKey,
          startsAt: dayEvents
            .map((event) => event.startsAt)
            .sort((a, b) => a.getTime() - b.getTime())[0],
          metrics: {
            totalOrders: activeDayOrders.length,
            paidOrders: paidDayOrders.length,
            pendingPaymentOrders: activeDayOrders.filter(
              (order) => order.paymentStatus === "PENDING",
            ).length,
            combosToPrepare: paidDayOrders
              .filter((order) =>
                TO_PREPARE_STATUSES.includes(
                  order.status as (typeof TO_PREPARE_STATUSES)[number],
                ),
              )
              .reduce(
                (sum, order) => sum + order.comboQuantity,
                0,
              ),
            readyCombos: paidDayOrders
              .filter((order) => order.status === "READY")
              .reduce(
                (sum, order) => sum + order.comboQuantity,
                0,
              ),
            receivedCents: paidDayOrders.reduce(
              (sum, order) => sum + order.totalCents,
              0,
            ),
            deliveryCashToCollectCents: paidDayOrders.reduce(
              (sum, order) =>
                sum + (order.groupDeliveryFinalFeeCents ?? 0),
              0,
            ),
          },
          groups: dayGroups,
          deliveryCharges,
        }
      : null;

    return {
      filter: {
        pickupEventId: pickupEventId ?? null,
        selectedEvent,
        events,
      },
      day,
      metrics: {
        revenueCents,
        combosSold,
        cokesSold,
        averageTicketCents,
        effectiveOrders: effectiveSales.length,
        cancelledOrders,
        refundedOrders,
        noShowOrders,
      },
      topExtras,
      salesByEvent,
    };
  }
}
