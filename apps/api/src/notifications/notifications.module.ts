import { Global, Module } from "@nestjs/common";
import { GroupTelegramNotificationService } from "./group-telegram-notification.service.js";
import { TelegramNotificationService } from "./telegram-notification.service.js";

@Global()
@Module({
  providers: [
    TelegramNotificationService,
    GroupTelegramNotificationService,
  ],
  exports: [
    TelegramNotificationService,
    GroupTelegramNotificationService,
  ],
})
export class NotificationsModule {}
