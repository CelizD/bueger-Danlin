import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module.js";
import { OrdersController } from "./orders.controller.js";
import { CustomerOrderAccessService } from "./customer-order-access.service.js";
import { CustomerOrdersService } from "./customer-orders.service.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, CustomerOrdersService, CustomerOrderAccessService],
})
export class OrdersModule {}
