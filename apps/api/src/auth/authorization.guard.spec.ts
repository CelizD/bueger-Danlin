import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "./admin.guard.js";
import { RolesGuard } from "./roles.guard.js";
import type { StaffRole, StaffSession } from "./auth.types.js";

function contextWithRole(role: StaffRole): ExecutionContext {
  const user: StaffSession = {
    sid: "session-1",
    sub: "user-1",
    email: "staff@example.com",
    name: "Staff",
    role,
    credentialVersion: "test-version",
  };

  return {
    switchToHttp: () =>
      ({
        getRequest: () => ({ user }),
      }) as ReturnType<ExecutionContext["switchToHttp"]>,
    getHandler: () => (() => undefined),
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("permite ADMIN", () => {
    expect(guard.canActivate(contextWithRole("ADMIN"))).toBe(true);
  });

  it.each(["KITCHEN", "DELIVERY"] as const)(
    "rechaza %s en una ruta administrativa",
    (role) => {
      expect(() => guard.canActivate(contextWithRole(role))).toThrow(
        ForbiddenException,
      );
    },
  );
});

describe("RolesGuard", () => {
  it.each([
    ["KITCHEN", "KITCHEN", ["ADMIN", "DELIVERY"]],
    ["DELIVERY", "DELIVERY", ["ADMIN", "KITCHEN"]],
  ] as const)(
    "permite solo %s en su área operativa",
    (_area, allowedRole, deniedRoles) => {
      const reflector = {
        getAllAndOverride: vi.fn().mockReturnValue([allowedRole]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(guard.canActivate(contextWithRole(allowedRole))).toBe(true);

      for (const deniedRole of deniedRoles) {
        expect(() =>
          guard.canActivate(contextWithRole(deniedRole)),
        ).toThrow(ForbiddenException);
      }
    },
  );

  it("deja pasar cuando una ruta no declara roles", () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole("DELIVERY"))).toBe(true);
  });
});
