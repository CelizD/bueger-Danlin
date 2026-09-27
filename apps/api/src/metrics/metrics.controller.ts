import {
  Controller,
  Get,
  Header,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../database/prisma.service.js";
import {
  MetricsService,
  type MetricsSnapshot,
} from "./metrics.service.js";

type CountRow = {
  status: string;
  count: bigint;
};

@Controller("metrics")
@SkipThrottle()
export class MetricsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  @Header(
    "Content-Type",
    "text/plain; version=0.0.4; charset=utf-8",
  )
  @Header("Cache-Control", "no-store")
  async scrape() {
    const startedAt = process.hrtime.bigint();
    const snapshot: MetricsSnapshot = {
      databaseUp: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      const [orders, payments, inventory] =
        await Promise.all([
          this.prisma.$queryRaw<CountRow[]>`
            SELECT status::text AS status, COUNT(*)::bigint AS count
            FROM "Order"
            GROUP BY status
            ORDER BY status
          `,
          this.prisma.$queryRaw<CountRow[]>`
            SELECT status::text AS status, COUNT(*)::bigint AS count
            FROM "Payment"
            GROUP BY status
            ORDER BY status
          `,
          this.prisma.inventoryItem.findMany({
            where: { active: true },
            select: {
              key: true,
              stockQuantity: true,
              lowStockThreshold: true,
            },
            orderBy: { key: "asc" },
          }),
        ]);

      snapshot.databaseUp = true;
      snapshot.databaseLatencySeconds =
        Number(process.hrtime.bigint() - startedAt) /
        1_000_000_000;
      snapshot.orderCounts = orders.map(
        (row) => ({
          status: row.status,
          count: Number(row.count),
        }),
      );
      snapshot.paymentCounts = payments.map(
        (row) => ({
          status: row.status,
          count: Number(row.count),
        }),
      );
      snapshot.inventory = inventory;
    } catch {
      snapshot.databaseUp = false;
    }

    return this.metrics.render(snapshot);
  }
}
