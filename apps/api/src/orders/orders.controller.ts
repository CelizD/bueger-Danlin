import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
import { CustomerOrdersService } from "./customer-orders.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly customerOrdersService: CustomerOrdersService,
  ) {}

  @Post()
  create(
    @Body() body: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException("Falta el encabezado Idempotency-Key.");
    }

    return this.ordersService.create(body, idempotencyKey);
  }

  @Get(":orderCode")
  getOne(
    @Param("orderCode") orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

    return this.customerOrdersService.getOrder(orderCode, verificationToken);
  }

  @Post(":orderCode/cancel")
  cancel(
    @Param("orderCode") orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

    return this.customerOrdersService.cancel(orderCode, verificationToken);
  }
}
