import { Controller, Get } from "@nestjs/common";
import { PickupEventsService } from "./pickup-events.service.js";

@Controller("pickup-events")
export class PickupEventsController {
  constructor(private readonly pickupEventsService: PickupEventsService) {}

  @Get("open")
  getOpen() {
    return this.pickupEventsService.getOpen();
  }

  @Get("current")
  getCurrent() {
    return this.pickupEventsService.getCurrent();
  }
}
