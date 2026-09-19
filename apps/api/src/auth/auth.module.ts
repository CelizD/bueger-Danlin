import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminGuard } from "./admin.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { STAFF_SESSION_SECONDS } from "./auth.constants.js";
import { StaffAuthGuard } from "./staff-auth.guard.js";
import { RolesGuard } from "./roles.guard.js";

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
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, StaffAuthGuard, AdminGuard, RolesGuard],
  exports: [StaffAuthGuard, AdminGuard, RolesGuard],
})
export class AuthModule {}
