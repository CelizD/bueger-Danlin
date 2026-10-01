import {
  UnauthorizedException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import {
  CustomerOrderAccessService,
  hasOrderAccessCookie,
  orderAccessCookieName,
  setOrderAccessCookie,
} from "./customer-order-access.service.js";
import { createOrderVerificationToken } from "./order-create-security.js";

const SECRET =
  "test-order-access-secret-at-least-thirty-two-characters";
const ORDER_CODE = "H-A1B2C3D4";
const ORDER_ID = "order-1";

function harness() {
  const prisma = {
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: ORDER_ID,
      }),
    },
  } as unknown as PrismaService;

  return {
    prisma,
    service:
      new CustomerOrderAccessService(
        prisma,
      ),
  };
}

describe("CustomerOrderAccessService", () => {
  beforeEach(() => {
    process.env.QR_TOKEN_SECRET = SECRET;
    process.env.NODE_ENV = "test";
  });

  it("usa una cookie aislada por pedido", () => {
    expect(
      orderAccessCookieName(
        ORDER_CODE,
      ),
    ).toBe(
      "burger_order_access_H_A1B2C3D4",
    );

    expect(
      hasOrderAccessCookie({
        burger_order_access_H_A1B2C3D4:
          "token",
      }),
    ).toBe(true);
  });

  it("separa el acceso del cliente del token QR", async () => {
    const { service } = harness();
    const accessToken =
      await service.issue(ORDER_CODE);
    const qrToken =
      createOrderVerificationToken(
        SECRET,
        ORDER_ID,
      );

    expect(accessToken).not.toBe(
      qrToken,
    );

    await expect(
      service.verificationToken(
        ORDER_CODE,
        accessToken,
      ),
    ).resolves.toBe(qrToken);
  });

  it("rechaza una cookie de acceso inválida", async () => {
    const { service } = harness();

    await expect(
      service.verificationToken(
        ORDER_CODE,
        "invalid-customer-order-access",
      ),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("genera el QR de entrega solo después de validar la cookie", async () => {
    const { service } = harness();
    const accessToken =
      await service.issue(ORDER_CODE);

    await expect(
      service.deliveryQrPayload(
        ORDER_CODE,
        accessToken,
      ),
    ).resolves.toEqual({
      orderCode: ORDER_CODE,
      qrPayload:
        `BD1:${ORDER_CODE}:${createOrderVerificationToken(
          SECRET,
          ORDER_ID,
        )}`,
    });
  });

  it("marca la cookie como HttpOnly y SameSite Strict", () => {
    const response = {
      cookie: vi.fn(),
    };

    setOrderAccessCookie(
      response,
      ORDER_CODE,
      "customer-access-token",
    );

    expect(
      response.cookie,
    ).toHaveBeenCalledWith(
      "burger_order_access_H_A1B2C3D4",
      "customer-access-token",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge:
          30 * 24 * 60 * 60 * 1000,
        path: "/",
      }),
    );
  });
});
