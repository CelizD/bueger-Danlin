import { Global, Module } from "@nestjs/common";
import { TelegramNotificationService } from "./telegram-notification.service.js";

@Global()
@Module({
  providers: [TelegramNotificationService],
  exports: [TelegramNotificationService],
})
export class NotificationsModule {}
