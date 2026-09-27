import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":orderCode/checkout")
  createCheckout(
    @Param("orderCode") orderCode: string,
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
  confirmMock(
    @Param("orderCode") orderCode: string,
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
