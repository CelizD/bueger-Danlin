import { Global, Module } from "@nestjs/common";
import { GroupTelegramNotificationService } from "./group-telegram-notification.service.js";
import { TelegramNotificationService } from "./telegram-notification.service.js";
import { PurchaseEmailService } from "./purchase-email.service.js";
import { SmtpMailTransport } from "./smtp-mail.transport.js";

@Global()
@Module({
  providers: [
    TelegramNotificationService,
    GroupTelegramNotificationService,
    PurchaseEmailService,
    SmtpMailTransport,
    PurchaseEmailService,
  ],
  exports: [
    TelegramNotificationService,
    GroupTelegramNotificationService,
  ],
})
export class NotificationsModule {}
