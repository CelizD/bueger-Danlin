import { Throttle } from "@nestjs/throttler";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import {
  MFA_CHALLENGE_COOKIE,
  MFA_CHALLENGE_SECONDS,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_SECONDS,
} from "./auth.constants.js";
import type { StaffRequest } from "./auth.types.js";
import { LoginDto } from "./dto/login.dto.js";
import { StaffAuthGuard } from "./staff-auth.guard.js";

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
  return process.env.NODE_ENV === "production"
    ? "strict"
    : "lax";
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post("login")
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true })
    response: CookieResponse,
  ) {
    const result = await this.authService.login(
      dto.email,
      dto.password,
    );

    if (result.mfaRequired) {
      response.clearCookie(STAFF_SESSION_COOKIE, {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: cookieSameSite(),
        path: "/",
      });

      response.cookie(
        MFA_CHALLENGE_COOKIE,
        result.challengeToken,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV === "production",
          sameSite: cookieSameSite(),
          maxAge: MFA_CHALLENGE_SECONDS * 1000,
          path: "/",
        },
      );

      return {
        mfaRequired: true,
        setupRequired: result.setupRequired,
      };
    }

    response.clearCookie(MFA_CHALLENGE_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: cookieSameSite(),
      path: "/",
    });

    response.cookie(
      STAFF_SESSION_COOKIE,
      result.token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: cookieSameSite(),
        maxAge: STAFF_SESSION_SECONDS * 1000,
        path: "/",
      },
    );

    return {
      mfaRequired: false,
      user: result.user,
    };
  }

  @Get("me")
  @UseGuards(StaffAuthGuard)
  me(@Req() request: StaffRequest) {
    const user = request.user!;

    return {
      user: {
        sub: user.sub,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  @Post("logout")
  @UseGuards(StaffAuthGuard)
  @HttpCode(204)
  logout(
    @Res({ passthrough: true })
    response: CookieResponse,
  ) {
    response.clearCookie(STAFF_SESSION_COOKIE, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: cookieSameSite(),
      path: "/",
    });

    response.clearCookie(MFA_CHALLENGE_COOKIE, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: cookieSameSite(),
      path: "/",
    });
  }
}
