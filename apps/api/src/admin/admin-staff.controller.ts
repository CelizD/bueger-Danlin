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

import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import { AdminStaffService } from "./admin-staff.service.js";
import { CreateStaffUserDto } from "./dto/create-staff-user.dto.js";
import { ResetStaffPasswordDto } from "./dto/reset-staff-password.dto.js";
import { UpdateStaffUserDto } from "./dto/update-staff-user.dto.js";

@ApiTags("Admin staff")
@ApiCookieAuth("burger_staff_session")
@Controller("admin/staff")
@UseGuards(StaffAuthGuard, AdminGuard)
export class AdminStaffController {
  constructor(private readonly staff: AdminStaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Post()
  create(
    @Body() dto: CreateStaffUserDto,
    @Req() request: StaffRequest,
  ) {
    return this.staff.create(dto, request.user!.sub);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateStaffUserDto,
    @Req() request: StaffRequest,
  ) {
    return this.staff.update(id, dto, request.user!.sub);
  }

  @Post(":id/mfa/reset")
  resetMfa(
    @Param("id") id: string,
    @Req() request: StaffRequest,
  ) {
    return this.staff.resetMfa(id, request.user!.sub);
  }

  @Post(":id/password")
  resetPassword(
    @Param("id") id: string,
    @Body() dto: ResetStaffPasswordDto,
    @Req() request: StaffRequest,
  ) {
    return this.staff.resetPassword(id, dto, request.user!.sub);
  }
}
