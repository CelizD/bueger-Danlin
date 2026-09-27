import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";
import { MockPaymentProvider } from "./providers/mock/mock-payment.provider.js";
import { WebhookSecurityService } from "./webhook-security.service.js";

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    WebhookSecurityService,
  ],
  exports: [WebhookSecurityService],
})
export class PaymentsModule {}
