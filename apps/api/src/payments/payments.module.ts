import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { PaymentsService } from "./payments.service.js";
import { MercadoPagoApiClient } from "./providers/mercadopago/mercadopago-api.client.js";
import { MercadoPagoProvider } from "./providers/mercadopago/mercadopago.provider.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";
import { WebhookSecurityService } from "./webhook-security.service.js";

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    MercadoPagoApiClient,
    MercadoPagoProvider,
    PaymentProviderRegistry,
    WebhookSecurityService,
  ],
  exports: [WebhookSecurityService],
})
export class PaymentsModule {}
