import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { RolesGuard } from "../auth/roles.guard.js";
import { StaffRoles } from "../auth/roles.decorator.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import { ScanDeliveryDto } from "./dto/scan-delivery.dto.js";
import { StaffOrdersService } from "./staff-orders.service.js";

@Controller("staff/delivery")
@UseGuards(StaffAuthGuard, RolesGuard)
@StaffRoles("ADMIN", "DELIVERY")
export class DeliveryController {
  constructor(private readonly staffOrders: StaffOrdersService) {}

  @Get("orders")
  list() {
    return this.staffOrders.deliveryOrders();
  }

  @Post("scan")
  scan(
    @Body() dto: ScanDeliveryDto,
    @Req() request: StaffRequest,
  ) {
    return this.staffOrders.deliverFromQr(dto.qrPayload, request.user!.sub);
  }

  @Patch("orders/:orderCode/delivered")
  delivered(
    @Param("orderCode") orderCode: string,
    @Req() request: StaffRequest,
  ) {
    return this.staffOrders.markDelivered(orderCode, request.user!.sub);
  }
}
