import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
        pickupEvent: {
          select: {
            code: true,
            name: true,
            locationLabel: true,
            startsAt: true,
            closesAt: true,
            timezone: true,
          },
        },
        items: {
          orderBy: { id: "asc" },
          include: {
            modifiers: {
              orderBy: { id: "asc" },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            provider: true,
            status: true,
            amountCents: true,
            paidAt: true,
          },
        },
      },
    });

    const summary = {
      totalOrders: orders.length,
      paidOrders: orders.filter((order) => order.paymentStatus === "PAID").length,
      pendingOrders: orders.filter(
        (order) => order.paymentStatus === "PENDING",
      ).length,
      totalCombos: orders
        .filter((order) =>
          ["PAID", "CONFIRMED", "PREPARING", "READY", "DELIVERED"].includes(
            order.status,
          ),
        )
        .reduce((total, order) => total + order.comboQuantity, 0),
      paidRevenueCents: orders
        .filter((order) => order.paymentStatus === "PAID")
        .reduce((total, order) => total + order.totalCents, 0),
    };

    return { summary, orders };
  }
}
