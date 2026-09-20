import { Controller, Get } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get("availability")
  availability() {
    return this.inventory.publicAvailability();
  }
}
