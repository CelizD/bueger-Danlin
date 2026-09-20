import "reflect-metadata";
import "./config/load-env.js";
import cookieParser from "cookie-parser";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module.js";
import { STAFF_SESSION_COOKIE } from "./auth/auth.constants.js";
import { validateProductionEnvironment } from "./config/validate-production-env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function allowedOrigins() {
  const configured = process.env.APP_ORIGIN
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured?.length) return configured;

  return ["http://localhost:3000"];
}

async function bootstrap() {
  validateProductionEnvironment();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const port = Number(process.env.API_PORT ?? 4000);
  const prefix = process.env.API_PREFIX ?? "api/v1";
  const isProduction = process.env.NODE_ENV === "production";
  const origins = allowedOrigins();
  const httpLogger = new Logger("HTTP");

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", isProduction ? 1 : false);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction
        ? {
            maxAge: 31_536_000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      referrerPolicy: {
        policy: "no-referrer",
      },
    }),
  );

  app.use(cookieParser());

  app.use((request: any, response: any, next: () => void) => {
    const requestIdHeader = request.headers["x-request-id"];
    const requestId =
      typeof requestIdHeader === "string" && requestIdHeader.length <= 100
        ? requestIdHeader
        : randomUUID();
    const startedAt = process.hrtime.bigint();

    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const entry = JSON.stringify({
        requestId,
        method: request.method,
        path: String(request.originalUrl ?? request.url ?? "").split("?")[0],
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        ip: request.ip,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"].slice(0, 180)
            : undefined,
      });

      if (response.statusCode >= 500) {
        httpLogger.error(entry);
      } else if (response.statusCode >= 400) {
        httpLogger.warn(entry);
      } else {
        httpLogger.log(entry);
      }
    });

    next();
  });

  app.use((request: any, response: any, next: () => void) => {
    if (!isProduction || process.env.FORCE_HTTPS === "false") {
      next();
      return;
    }

    const forwardedProto = request.headers["x-forwarded-proto"];
    const secure =
      request.secure ||
      forwardedProto === "https" ||
      (Array.isArray(forwardedProto) && forwardedProto.includes("https"));

    if (secure) {
      next();
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const host = request.headers.host;
      if (host) {
        response.redirect(
          308,
          `https://${host}${request.originalUrl ?? request.url ?? "/"}`,
        );
        return;
      }
    }

    response.status(426).json({
      statusCode: 426,
      message: "HTTPS is required.",
    });
  });

  app.use((request: any, response: any, next: () => void) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const path = String(request.originalUrl ?? request.url ?? "");
    const hasStaffCookie = Boolean(
      request.cookies?.[STAFF_SESSION_COOKIE],
    );
    const browserStaffMutation =
      hasStaffCookie ||
      /\/(auth\/(login|logout|mfa\/)|admin\/|staff\/)/.test(path);

    if (!browserStaffMutation) {
      next();
      return;
    }

    const origin = request.headers.origin;
    const fetchSite = request.headers["sec-fetch-site"];

    if (
      typeof origin !== "string" ||
      !origins.includes(origin) ||
      fetchSite === "cross-site"
    ) {
      response.status(403).json({
        statusCode: 403,
        message: "Solicitud bloqueada por protección CSRF.",
      });
      return;
    }

    next();
  });

  app.setGlobalPrefix(prefix);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Idempotency-Key",
      "X-Order-Token",
      "X-Request-Id",
      "Stripe-Signature",
      "X-Signature",
    ],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
}

void bootstrap();
