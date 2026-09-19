import { Module } from "@nestjs/common";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PaymentsModule } from "./payments/payments.module.js";
import { PickupEventsModule } from "./pickup-events/pickup-events.module.js";

@Module({
  imports: [
    DatabaseModule,
    CatalogModule,
    PickupEventsModule,
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
