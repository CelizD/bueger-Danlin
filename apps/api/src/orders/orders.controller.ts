import { Throttle } from "@nestjs/throttler";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  StreamableFile,
  Param,
  Post,
} from "@nestjs/common";
import { CustomerOrdersService } from "./customer-orders.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";
import { OrderCodePipe } from "./order-code.pipe.js";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly customerOrdersService: CustomerOrdersService,
  ) {}

  @Post()
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
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
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 60,
      ttl: 60_000,
    },
  })
  getOne(
    @Param("orderCode", OrderCodePipe) orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

    return this.customerOrdersService.getOrder(orderCode, verificationToken);
  }

  @Get(":orderCode/receipt")
  @Header("Cache-Control", "private, no-store")
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
  async receipt(
    @Param("orderCode", OrderCodePipe) orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

    const receipt =
      await this.customerOrdersService.getReceipt(
        orderCode,
        verificationToken,
      );

    return new StreamableFile(
      receipt.pdf,
      {
        type: "application/pdf",
        disposition:
          'attachment; filename="' +
          receipt.filename +
          '"',
        length: receipt.pdf.length,
      },
    );
  }

  @Post(":orderCode/cancel")
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 12,
      ttl: 60_000,
    },
  })
  cancel(
    @Param("orderCode", OrderCodePipe) orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

    return this.customerOrdersService.cancel(orderCode, verificationToken);
  }
}
