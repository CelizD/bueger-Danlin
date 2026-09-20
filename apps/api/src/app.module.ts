import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { PickupEventsModule } from "./pickup-events/pickup-events.module.js";
import { StaffModule } from "./staff/staff.module.js";
import { TelemetryController } from "./telemetry/telemetry.controller.js";

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    AuthModule,
    AdminModule,
    CatalogModule,
    PickupEventsModule,
    OrdersModule,
    PaymentsModule,
    StaffModule,
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 120,
      },
    ]),
  ],
  controllers: [HealthController, TelemetryController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
