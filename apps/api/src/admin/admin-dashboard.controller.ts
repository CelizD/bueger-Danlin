import {
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import { AdminDashboardService } from "./admin-dashboard.service.js";

@Controller("admin/dashboard")
@UseGuards(StaffAuthGuard, AdminGuard)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  get(@Query("pickupEventId") pickupEventId?: string) {
    return this.dashboard.getDashboard(
      pickupEventId?.trim() || undefined,
    );
  }
}
