import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
} from "@nestjs/common";
import {
  PaymentWebhookService,
  type MercadoPagoWebhookBody,
} from "./payment-webhook.service.js";

@Controller("payments/webhooks")
export class PaymentWebhooksController {
  constructor(
    private readonly webhooks: PaymentWebhookService,
  ) {}

  @Post("mercadopago")
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 300,
      ttl: 60_000,
    },
  })
  mercadoPago(
    @Body() body: MercadoPagoWebhookBody,
    @Headers("x-signature") signatureHeader?: string,
    @Headers("x-request-id") requestId?: string,
    @Query("data.id") dataId?: string,
    @Query("type") queryType?: string,
  ) {
    return this.webhooks.handleMercadoPago({
      body,
      signatureHeader,
      requestId,
      dataId,
      queryType,
    });
  }
}
