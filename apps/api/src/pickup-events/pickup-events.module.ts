import { Module } from "@nestjs/common";
import { PickupEventsController } from "./pickup-events.controller.js";
import { PickupEventsService } from "./pickup-events.service.js";

@Module({
  controllers: [PickupEventsController],
  providers: [PickupEventsService],
  exports: [PickupEventsService],
})
export class PickupEventsModule {}
