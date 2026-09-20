import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminDashboardController } from "./admin-dashboard.controller.js";
import { AdminOrdersController } from "./admin-orders.controller.js";
import { AdminPickupEventsController } from "./admin-pickup-events.controller.js";
import { AdminStaffController } from "./admin-staff.controller.js";
import { AdminDashboardService } from "./admin-dashboard.service.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { AdminPickupEventsService } from "./admin-pickup-events.service.js";
import { AdminStaffService } from "./admin-staff.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AdminDashboardController, AdminOrdersController, AdminPickupEventsController, AdminStaffController],
  providers: [AdminDashboardService, AdminOrdersService, AdminPickupEventsService, AdminStaffService],
})
export class AdminModule {}
