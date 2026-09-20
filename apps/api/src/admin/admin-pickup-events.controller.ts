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
import { AdminPickupEventsService } from "./admin-pickup-events.service.js";
import { CreatePickupEventDto } from "./dto/create-pickup-event.dto.js";
import { UpdatePickupEventDto } from "./dto/update-pickup-event.dto.js";

@ApiTags("Admin pickup events")
@ApiCookieAuth("burger_staff_session")
@Controller("admin/pickup-events")
@UseGuards(StaffAuthGuard, AdminGuard)
export class AdminPickupEventsController {
  constructor(
    private readonly pickupEvents: AdminPickupEventsService,
  ) {}

  @Get()
  list() {
    return this.pickupEvents.list();
  }

  @Post()
  create(
    @Body() dto: CreatePickupEventDto,
    @Req() request: StaffRequest,
  ) {
    return this.pickupEvents.create(dto, request.user!.sub);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePickupEventDto,
    @Req() request: StaffRequest,
  ) {
    return this.pickupEvents.update(id, dto, request.user!.sub);
  }

  @Post(":id/open")
  open(
    @Param("id") id: string,
    @Req() request: StaffRequest,
  ) {
    return this.pickupEvents.open(id, request.user!.sub);
  }

  @Post(":id/close")
  close(
    @Param("id") id: string,
    @Req() request: StaffRequest,
  ) {
    return this.pickupEvents.close(id, request.user!.sub);
  }
}
