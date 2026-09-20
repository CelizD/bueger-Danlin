import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto.js";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto.js";

@Controller("admin/inventory")
@UseGuards(StaffAuthGuard, AdminGuard)
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list() {
    return this.inventory.adminList();
  }

  @Post()
  create(
    @Body() dto: CreateInventoryItemDto,
    @Req() request: StaffRequest,
  ) {
    return this.inventory.createItem(dto, request.user!.sub);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateInventoryItemDto,
    @Req() request: StaffRequest,
  ) {
    return this.inventory.updateItem(id, dto, request.user!.sub);
  }

  @Delete(":id")
  remove(
    @Param("id") id: string,
    @Req() request: StaffRequest,
  ) {
    return this.inventory.deleteItem(id, request.user!.sub);
  }
}
