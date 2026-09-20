import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminGuard } from "./admin.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import {
  STAFF_JWT_ALGORITHM,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
  STAFF_SESSION_SECONDS,
} from "./auth.constants.js";
import { MfaController } from "./mfa.controller.js";
import { MfaService } from "./mfa.service.js";
import { RolesGuard } from "./roles.guard.js";
import { StaffAuthGuard } from "./staff-auth.guard.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.AUTH_JWT_SECRET;

        if (!secret || secret.length < 32) {
          throw new Error(
            "AUTH_JWT_SECRET is required and must contain at least 32 characters",
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: STAFF_SESSION_SECONDS,
            algorithm: STAFF_JWT_ALGORITHM,
            issuer: STAFF_JWT_ISSUER,
            audience: STAFF_JWT_AUDIENCE,
          },
          verifyOptions: {
            algorithms: [STAFF_JWT_ALGORITHM],
            issuer: STAFF_JWT_ISSUER,
            audience: STAFF_JWT_AUDIENCE,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    MfaService,
    StaffAuthGuard,
    AdminGuard,
    RolesGuard,
  ],
  exports: [StaffAuthGuard, AdminGuard, RolesGuard],
})
export class AuthModule {}
