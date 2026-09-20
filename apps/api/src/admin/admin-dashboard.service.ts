import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

const CANCELLED_STATUSES = ["CANCELLED", "REFUNDED"] as const;

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
      },
    });

    const orders = await this.prisma.order.findMany({
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
    });

    const effectiveSales = orders.filter(
      (order) =>
        order.paymentStatus === "PAID" &&
        !CANCELLED_STATUSES.includes(
          order.status as (typeof CANCELLED_STATUSES)[number],
        ),
    );

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
        order.status === "REFUNDED" || order.paymentStatus === "REFUNDED",
    ).length;
    const noShowOrders = orders.filter(
      (order) => order.status === "NO_SHOW",
    ).length;

    const extrasMap = new Map<string, { quantity: number; revenueCents: number }>();
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

    const selectedEvent =
      pickupEventId != null
        ? events.find((event) => event.id === pickupEventId) ?? null
        : null;

    return {
      filter: {
        pickupEventId: pickupEventId ?? null,
        selectedEvent,
        events,
      },
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
