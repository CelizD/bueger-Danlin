import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DeliveryController } from "./delivery.controller.js";
import { KitchenController } from "./kitchen.controller.js";
import { StaffOrdersService } from "./staff-orders.service.js";

@Module({
  imports: [AuthModule],
  controllers: [KitchenController, DeliveryController],
  providers: [StaffOrdersService],
})
export class StaffModule {}
