import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Logger,
  Post,
} from "@nestjs/common";
import { ClientErrorDto } from "./client-error.dto.js";
import { WebVitalsDto } from "./web-vitals.dto.js";

@Controller("telemetry")
export class TelemetryController {
  private readonly logger = new Logger("WebVitals");

  @Post("web-vitals")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  recordWebVital(
    @Body() metric: WebVitalsDto,
    @Headers("x-request-id") requestId?: string,
  ) {
    this.logger.log(
      JSON.stringify({
        type: "web-vital",
        requestId,
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        metricId: metric.metricId,
        route: metric.route,
        navigationType: metric.navigationType,
      }),
    );
  }

  @Post("client-error")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  recordClientError(
    @Body() error: ClientErrorDto,
    @Headers("x-request-id") requestId?: string,
  ) {
    this.logger.warn(
      JSON.stringify({
        type: "client-error",
        requestId,
        kind: error.kind,
        route: error.route,
        errorName: error.errorName,
        digest: error.digest,
      }),
    );
  }
}
