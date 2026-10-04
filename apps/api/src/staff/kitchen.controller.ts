import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";

import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { RolesGuard } from "../auth/roles.guard.js";
import { StaffRoles } from "../auth/roles.decorator.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import { StaffOrdersService } from "./staff-orders.service.js";

@ApiTags("Kitchen")
@ApiCookieAuth("burger_staff_session")
@Controller("staff/kitchen")
@UseGuards(StaffAuthGuard, RolesGuard)
@StaffRoles("ADMIN", "KITCHEN")
export class KitchenController {
  constructor(private readonly staffOrders: StaffOrdersService) {}

  @Get("orders")
  list() {
    return this.staffOrders.kitchenOrders();
  }

  @Patch("orders/:orderCode/preparing")
  preparing(
    @Param("orderCode") orderCode: string,
    @Req() request: StaffRequest,
  ) {
    return this.staffOrders.startPreparing(orderCode, request.user!.sub);
  }

  @Patch("orders/:orderCode/ready")
  ready(
    @Param("orderCode") orderCode: string,
    @Req() request: StaffRequest,
  ) {
    return this.staffOrders.markReady(orderCode, request.user!.sub);
  }
}
