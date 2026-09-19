import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminOrdersController } from "./admin-orders.controller.js";
import { AdminOrdersService } from "./admin-orders.service.js";

@Module({
  imports: [AuthModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
})
export class AdminModule {}
