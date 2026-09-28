import type { PrismaService } from "../database/prisma.service.js";
import type { fetchDashboardEvents } from "./admin-dashboard-events.js";

type DashboardEvents = Awaited<
  ReturnType<typeof fetchDashboardEvents>
>;

export async function fetchDashboardOrders(
  prisma: PrismaService,
  pickupEventId: string | undefined,
  dayEvents: DashboardEvents,
) {
  return Promise.all([
    prisma.order.findMany({
      where: pickupEventId
        ? { pickupEventId }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
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
      ? prisma.order.findMany({
          where: {
            pickupEventId: {
              in: dayEvents.map(
                (event) => event.id,
              ),
            },
          },
          orderBy: [
            {
              pickupEventId: "asc",
            },
            {
              createdAt: "asc",
            },
          ],
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
}
