import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../database/prisma.service.js";

@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  check() {
    return this.live();
  }

  @Get("live")
  @Header("Cache-Control", "no-store")
  live() {
    return {
      status: "ok",
      check: "liveness",
      service: "burger-danlin-api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get("ready")
  @Header("Cache-Control", "no-store")
  async ready() {
    const startedAt = process.hrtime.bigint();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      const databaseLatencyMs =
        Number(process.hrtime.bigint() - startedAt) /
        1_000_000;

      return {
        status: "ok",
        check: "readiness",
        service: "burger-danlin-api",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: {
            status: "up",
            latencyMs:
              Math.round(databaseLatencyMs * 10) / 10,
          },
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        check: "readiness",
        service: "burger-danlin-api",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: {
            status: "down",
          },
        },
      });
    }
  }
}
