import { Throttle } from "@nestjs/throttler";
import {
  BadRequestException,
  Controller,
  Header,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
import { OrderCodePipe } from "../orders/order-code.pipe.js";
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":orderCode/checkout")
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  createCheckout(
    @Param("orderCode", OrderCodePipe) orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

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
  confirmMock(
    @Param("orderCode", OrderCodePipe) orderCode: string,
    @Headers("x-order-token") verificationToken?: string,
  ) {
    if (!verificationToken) {
      throw new BadRequestException("Falta el encabezado X-Order-Token.");
    }

    return this.paymentsService.confirmMockPayment(
      orderCode,
      verificationToken,
    );
  }
}
