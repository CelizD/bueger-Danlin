import { Module } from "@nestjs/common";
import { CustomerOrderAccessService } from "../orders/customer-order-access.service.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentWebhooksController } from "./payment-webhooks.controller.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";
import { PaymentsService } from "./payments.service.js";
import { PaymentWebhookService } from "./payment-webhook.service.js";
import { MercadoPagoApiClient } from "./providers/mercadopago/mercadopago-api.client.js";
import { MercadoPagoProvider } from "./providers/mercadopago/mercadopago.provider.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";
import { WebhookSecurityService } from "./webhook-security.service.js";

@Module({
  controllers: [PaymentsController, PaymentWebhooksController],
  providers: [
    PaymentsService,
    CustomerOrderAccessService,
    PaymentWebhookService,
    MockPaymentProvider,
    MercadoPagoApiClient,
    MercadoPagoProvider,
    PaymentProviderRegistry,
    WebhookSecurityService,
  ],
  exports: [WebhookSecurityService, PaymentProviderRegistry],
})
export class PaymentsModule {}
