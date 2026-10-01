import { Throttle } from "@nestjs/throttler";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  CustomerOrderAccessService,
  type OrderAccessCookieResponse,
  type OrderAccessRequest,
  readOrderAccessCookie,
  setOrderAccessCookie,
} from "./customer-order-access.service.js";
import { CustomerOrdersService } from "./customer-orders.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";
import { OrderCodePipe } from "./order-code.pipe.js";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly customerOrdersService: CustomerOrdersService,
    private readonly customerOrderAccess: CustomerOrderAccessService,
  ) {}

  @Post()
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
  async create(
    @Body() body: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: OrderAccessCookieResponse,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        "Falta el encabezado Idempotency-Key.",
      );
    }

    const created =
      await this.ordersService.create(
        body,
        idempotencyKey,
      );
    const accessToken =
      await this.customerOrderAccess.issue(
        created.orderCode,
      );

    setOrderAccessCookie(
      response,
      created.orderCode,
      accessToken,
    );

    const {
      verificationToken: _deliveryToken,
      ...publicOrder
    } = created;

    return publicOrder;
  }

  @Get(":orderCode")
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 60,
      ttl: 60_000,
    },
  })
  async getOne(
    @Param("orderCode", OrderCodePipe)
    orderCode: string,
    @Req() request: OrderAccessRequest,
  ) {
    const verificationToken =
      await this.customerOrderAccess.verificationToken(
        orderCode,
        readOrderAccessCookie(
          request,
          orderCode,
        ),
      );

    return this.customerOrdersService.getOrder(
      orderCode,
      verificationToken,
    );
  }

  @Get(":orderCode/delivery-qr")
  @Header("Cache-Control", "private, no-store")
  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
    },
  })
  deliveryQr(
    @Param("orderCode", OrderCodePipe)
    orderCode: string,
    @Req() request: OrderAccessRequest,
  ) {
    return this.customerOrderAccess.deliveryQrPayload(
      orderCode,
      readOrderAccessCookie(
        request,
        orderCode,
      ),
    );
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
    @Param("orderCode", OrderCodePipe)
    orderCode: string,
    @Req() request: OrderAccessRequest,
  ) {
    const verificationToken =
      await this.customerOrderAccess.verificationToken(
        orderCode,
        readOrderAccessCookie(
          request,
          orderCode,
        ),
      );
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
  async cancel(
    @Param("orderCode", OrderCodePipe)
    orderCode: string,
    @Req() request: OrderAccessRequest,
  ) {
    const verificationToken =
      await this.customerOrderAccess.verificationToken(
        orderCode,
        readOrderAccessCookie(
          request,
          orderCode,
        ),
      );

    return this.customerOrdersService.cancel(
      orderCode,
      verificationToken,
    );
  }
}
