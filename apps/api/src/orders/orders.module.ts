import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller.js";
import { CustomerOrdersService } from "./customer-orders.service.js";
import { OrdersService } from "./orders.service.js";

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, CustomerOrdersService],
})
export class OrdersModule {}
