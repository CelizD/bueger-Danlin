import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminOrdersController } from "./admin-orders.controller.js";
import { AdminPickupEventsController } from "./admin-pickup-events.controller.js";
import { AdminStaffController } from "./admin-staff.controller.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { AdminPickupEventsService } from "./admin-pickup-events.service.js";
import { AdminStaffService } from "./admin-staff.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AdminOrdersController, AdminPickupEventsController, AdminStaffController],
  providers: [AdminOrdersService, AdminPickupEventsService, AdminStaffService],
})
export class AdminModule {}
