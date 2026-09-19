import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { PickupEventsModule } from "./pickup-events/pickup-events.module.js";
import { StaffModule } from "./staff/staff.module.js";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AdminModule,
    CatalogModule,
    PickupEventsModule,
    OrdersModule,
    PaymentsModule,
    StaffModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
