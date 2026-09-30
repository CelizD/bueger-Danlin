import { Global, Module } from "@nestjs/common";
import { GroupTelegramNotificationService } from "./group-telegram-notification.service.js";
import { PurchaseEmailService } from "./purchase-email.service.js";
import { SmtpMailTransport } from "./smtp-mail.transport.js";
import { TelegramNotificationService } from "./telegram-notification.service.js";

@Global()
@Module({
  providers: [
    TelegramNotificationService,
    GroupTelegramNotificationService,
    SmtpMailTransport,
    PurchaseEmailService,
  ],
  exports: [
    TelegramNotificationService,
    GroupTelegramNotificationService,
    PurchaseEmailService,
  ],
})
export class NotificationsModule {}
