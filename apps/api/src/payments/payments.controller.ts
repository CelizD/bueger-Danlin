import { Throttle } from "@nestjs/throttler";
import {
  Controller,
  Header,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  CustomerOrderAccessService,
  type OrderAccessRequest,
  readOrderAccessCookie,
} from "../orders/customer-order-access.service.js";
import { OrderCodePipe } from "../orders/order-code.pipe.js";
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly customerOrderAccess: CustomerOrderAccessService,
  ) {}

  @Post(":orderCode/checkout")
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  async createCheckout(
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

    return this.paymentsService.createCheckout(
      orderCode,
      verificationToken,
    );
  }

  @Post("mock/:orderCode/confirm")
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  async confirmMock(
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

    return this.paymentsService.confirmMockPayment(
      orderCode,
      verificationToken,
    );
  }
}
