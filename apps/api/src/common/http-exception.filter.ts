import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

type HttpRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
};

type HttpResponse = {
  status: (code: number) => HttpResponse;
  json: (body: unknown) => void;
  getHeader: (name: string) => string | number | string[] | undefined;
};

function errorCode(status: number) {
  const names: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_SERVER_ERROR",
    503: "SERVICE_UNAVAILABLE",
  };

  return names[status] ?? `HTTP_${status}`;
}

function publicMessage(exception: unknown, status: number) {
  if (!(exception instanceof HttpException)) {
    return "Ocurrió un error interno.";
  }

  const response = exception.getResponse();

  if (typeof response === "string") {
    return response;
  }

  if (
    response &&
    typeof response === "object" &&
    "message" in response
  ) {
    const message = (
      response as { message?: unknown }
    ).message;

    if (
      typeof message === "string" ||
      (Array.isArray(message) &&
        message.every(
          (item) => typeof item === "string",
        ))
    ) {
      return message;
    }
  }

  if (status >= 500) {
    return "Ocurrió un error interno.";
  }

  return exception.message;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HTTPException");

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response =
      context.getResponse<HttpResponse>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestIdValue =
      response.getHeader("x-request-id");
    const requestId =
      typeof requestIdValue === "string"
        ? requestIdValue
        : Array.isArray(requestIdValue)
          ? requestIdValue[0]
          : requestIdValue !== undefined
            ? String(requestIdValue)
            : undefined;

    if (status >= 500) {
      const internal =
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
            }
          : {
              name: "UnknownError",
            };

      this.logger.error(
        JSON.stringify({
          requestId,
          method: request.method,
          path: String(
            request.originalUrl ??
              request.url ??
              "",
          ).split("?")[0],
          statusCode: status,
          error: internal,
        }),
      );
    }

    response.status(status).json({
      error: {
        code: errorCode(status),
        message: publicMessage(
          exception,
          status,
        ),
        requestId,
      },
    });
  }
}
