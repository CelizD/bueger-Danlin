import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  MFA_CHALLENGE_COOKIE,
  MFA_CHALLENGE_SECONDS,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_SECONDS,
} from "./auth.constants.js";
import type { StaffRequest } from "./auth.types.js";
import { MfaCodeDto } from "./dto/mfa-code.dto.js";
import { MfaService } from "./mfa.service.js";

type CookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax" | "strict";
      maxAge: number;
      path: string;
    },
  ) => void;
  clearCookie: (
    name: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax" | "strict";
      path: string;
    },
  ) => void;
};

function cookieSameSite() {
  return process.env.NODE_ENV === "production" ? "strict" : "lax";
}

@Controller("auth/mfa")
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get("setup")
  @Header("Cache-Control", "no-store")
  setup(@Req() request: StaffRequest) {
    const challengeToken =
      request.cookies?.[MFA_CHALLENGE_COOKIE];

    if (!challengeToken) {
      throw new UnauthorizedException(
        "Inicia sesión nuevamente para configurar MFA.",
      );
    }

    return this.mfaService.getSetup(challengeToken);
  }

  @Post("verify")
  @Header("Cache-Control", "no-store")
  @Throttle({
    default: {
      limit: 10,
      ttl: 5 * 60_000,
    },
  })
  @HttpCode(200)
  async verify(
    @Body() dto: MfaCodeDto,
    @Req() request: StaffRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const challengeToken =
      request.cookies?.[MFA_CHALLENGE_COOKIE];

    if (!challengeToken) {
      throw new UnauthorizedException(
        "El desafío MFA expiró. Inicia sesión nuevamente.",
      );
    }

    const result =
      await this.mfaService.verifyAndCreateSession(
        challengeToken,
        dto.code,
      );

    response.cookie(STAFF_SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: cookieSameSite(),
      maxAge: STAFF_SESSION_SECONDS * 1000,
      path: "/",
    });

    response.clearCookie(MFA_CHALLENGE_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: cookieSameSite(),
      path: "/",
    });

    return {
      user: result.user,
      recoveryCodes: result.recoveryCodes ?? null,
    };
  }
}
