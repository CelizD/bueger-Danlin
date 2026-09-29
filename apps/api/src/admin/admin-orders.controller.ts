import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import { OrderCodePipe } from "../orders/order-code.pipe.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { RefundLatePaymentDto } from "./dto/refund-late-payment.dto.js";

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

  @Post(":orderCode/refund-late-payment")
  refundLatePayment(
    @Param("orderCode", OrderCodePipe)
    orderCode: string,
    @Body() _dto: RefundLatePaymentDto,
    @Req() request: StaffRequest,
  ) {
    return this.adminOrdersService.refundLatePayment(
      orderCode,
      request.user!.sub,
    );
  }
}
