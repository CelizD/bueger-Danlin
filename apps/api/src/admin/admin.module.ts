import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { AdminDashboardController } from "./admin-dashboard.controller.js";
import { AdminInventoryController } from "./admin-inventory.controller.js";
import { AdminOrdersController } from "./admin-orders.controller.js";
import { AdminProductsController } from "./admin-products.controller.js";
import { AdminPickupEventsController } from "./admin-pickup-events.controller.js";
import { AdminStaffController } from "./admin-staff.controller.js";
import { AdminDashboardService } from "./admin-dashboard.service.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { AdminProductsService } from "./admin-products.service.js";
import { AdminPickupEventsService } from "./admin-pickup-events.service.js";
import { AdminStaffService } from "./admin-staff.service.js";

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [AdminDashboardController, AdminInventoryController, AdminOrdersController, AdminPickupEventsController, AdminProductsController, AdminStaffController],
  providers: [AdminDashboardService, AdminOrdersService, AdminPickupEventsService, AdminProductsService, AdminStaffService],
})
export class AdminModule {}
