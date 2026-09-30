import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { CreateArcoRequestDto } from "./dto/create-arco-request.dto.js";
import { PrivacyService } from "./privacy.service.js";

@ApiTags("Privacy")
@Controller("privacy")
export class PrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
  ) {}

  @Post("arco")
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  createArco(
    @Body()
    dto: CreateArcoRequestDto,
  ) {
    return this.privacy
      .createArcoRequest(dto);
  }
}
