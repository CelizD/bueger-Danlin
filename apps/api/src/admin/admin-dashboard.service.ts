import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { summarizeDashboardOrders } from "./admin-dashboard-analytics.js";
import { buildDashboardDay } from "./admin-dashboard-day.js";
import {
  fetchDashboardEvents,
  resolveDashboardDayContext,
} from "./admin-dashboard-events.js";
import { fetchDashboardOrders } from "./admin-dashboard-queries.js";

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getDashboard(
    pickupEventId?: string,
  ) {
    const events =
      await fetchDashboardEvents(
        this.prisma,
      );

    const {
      selectedEvent,
      dayAnchor,
      dayKey,
      dayEvents,
    } = resolveDashboardDayContext(
      events,
      pickupEventId,
      new Date(),
    );

    const [orders, dayOrders] =
      await fetchDashboardOrders(
        this.prisma,
        pickupEventId,
        dayEvents,
      );

    const analytics =
      summarizeDashboardOrders(
        orders,
      );

    const day = buildDashboardDay(
      dayAnchor,
      dayKey,
      dayEvents,
      dayOrders,
    );

    return {
      filter: {
        pickupEventId:
          pickupEventId ?? null,
        selectedEvent,
        events,
      },
      day,
      ...analytics,
    };
  }
}
