import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiTags,
} from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import { UpdateArcoRequestDto } from "./dto/update-arco-request.dto.js";
import { PrivacyService } from "./privacy.service.js";

@ApiTags("Admin privacy")
@ApiCookieAuth("burger_staff_session")
@Controller("admin/arco")
@UseGuards(
  StaffAuthGuard,
  AdminGuard,
)
export class AdminArcoController {
  constructor(
    private readonly privacy: PrivacyService,
  ) {}

  @Get()
  list() {
    return this.privacy
      .listArcoRequests();
  }

  @Patch(":folio")
  update(
    @Param("folio")
    folio: string,
    @Body()
    dto: UpdateArcoRequestDto,
    @Req()
    request: StaffRequest,
  ) {
    return this.privacy
      .updateArcoRequest(
        folio,
        dto,
        request.user!.sub,
      );
  }
}
