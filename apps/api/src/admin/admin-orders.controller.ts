import { Controller, Get, UseGuards } from "@nestjs/common";

import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import { AdminOrdersService } from "./admin-orders.service.js";

@ApiTags("Admin orders")
@ApiCookieAuth("burger_staff_session")
@Controller("admin/orders")
@UseGuards(StaffAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  list() {
    return this.adminOrdersService.listOrders();
  }
}
