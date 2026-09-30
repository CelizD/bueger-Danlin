import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminArcoController } from "./admin-arco.controller.js";
import { ArcoNotificationService } from "./arco-notification.service.js";
import { PrivacyController } from "./privacy.controller.js";
import { PrivacyService } from "./privacy.service.js";

@Module({
  imports: [AuthModule],
  controllers: [
    PrivacyController,
    AdminArcoController,
  ],
  providers: [
    PrivacyService,
    ArcoNotificationService,
  ],
})
export class PrivacyModule {}
