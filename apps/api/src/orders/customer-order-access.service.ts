import {
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaService } from "../database/prisma.service.js";
import { createOrderVerificationToken } from "./order-create-security.js";

const COOKIE_PREFIX = "burger_order_access_";
const ACCESS_CONTEXT = "customer-order-access:";

export type OrderAccessCookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "strict";
      maxAge: number;
      path: string;
    },
  ) => void;
};

export type OrderAccessRequest = {
  cookies?: Record<string, string | undefined>;
};

export function orderAccessCookieName(
  orderCode: string,
) {
  return (
    COOKIE_PREFIX +
    orderCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
  );
}

export function hasOrderAccessCookie(
  cookies:
    | Record<string, string | undefined>
    | undefined,
) {
  return Object.keys(cookies ?? {}).some(
    (name) => name.startsWith(COOKIE_PREFIX),
  );
}

export function setOrderAccessCookie(
  response: OrderAccessCookieResponse,
  orderCode: string,
  token: string,
) {
  response.cookie(
    orderAccessCookieName(orderCode),
    token,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    },
  );
}

export function readOrderAccessCookie(
  request: OrderAccessRequest,
  orderCode: string,
) {
  return request.cookies?.[
    orderAccessCookieName(orderCode)
  ];
}

function createOrderAccessToken(
  secret: string,
  orderId: string,
) {
  return createHmac("sha256", secret)
    .update(ACCESS_CONTEXT + orderId)
    .digest("base64url");
}

function safeTokenEqual(
  expected: string,
  actual: string,
) {
  const expectedBuffer =
    Buffer.from(expected);
  const actualBuffer =
    Buffer.from(actual);

  return (
    expectedBuffer.length ===
      actualBuffer.length &&
    timingSafeEqual(
      expectedBuffer,
      actualBuffer,
    )
  );
}

export class CustomerOrderAccessService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
  ) {
    const secret =
      process.env.QR_TOKEN_SECRET;

    if (!secret) {
      throw new Error(
        "QR_TOKEN_SECRET is required",
      );
    }

    this.secret = secret;
  }

  async issue(orderCodeInput: string) {
    const orderCode =
      orderCodeInput.trim().toUpperCase();
    const order =
      await this.prisma.order.findUnique({
        where: { orderCode },
        select: { id: true },
      });

    if (!order) {
      throw new NotFoundException(
        "El pedido no existe.",
      );
    }

    return createOrderAccessToken(
      this.secret,
      order.id,
    );
  }

  async verificationToken(
    orderCodeInput: string,
    accessToken: string | undefined,
  ) {
    if (!accessToken) {
      throw new UnauthorizedException(
        "Este navegador no tiene acceso a este pedido.",
      );
    }

    const orderCode =
      orderCodeInput.trim().toUpperCase();
    const order =
      await this.prisma.order.findUnique({
        where: { orderCode },
        select: { id: true },
      });

    if (!order) {
      throw new NotFoundException(
        "El pedido no existe.",
      );
    }

    const expected =
      createOrderAccessToken(
        this.secret,
        order.id,
      );

    if (
      !safeTokenEqual(
        expected,
        accessToken,
      )
    ) {
      throw new UnauthorizedException(
        "El acceso de este pedido no es válido.",
      );
    }

    return createOrderVerificationToken(
      this.secret,
      order.id,
    );
  }

  async deliveryQrPayload(
    orderCodeInput: string,
    accessToken: string | undefined,
  ) {
    const orderCode =
      orderCodeInput.trim().toUpperCase();
    const verificationToken =
      await this.verificationToken(
        orderCode,
        accessToken,
      );

    return {
      orderCode,
      qrPayload:
        `BD1:${orderCode}:${verificationToken}`,
    };
  }
}
