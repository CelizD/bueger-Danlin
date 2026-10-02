import { afterEach, describe, expect, it } from "vitest";
import {
  formatTraceparent,
  normalizeOtlpTraceEndpoint,
  parseTraceparent,
  shouldPropagateTraceToHost,
} from "./tracing.js";

afterEach(() => {
  delete process.env.OTEL_PROPAGATE_HOSTS;
});

describe("OpenTelemetry tracing helpers", () => {
  it("accepts a valid W3C traceparent", () => {
    const parsed = parseTraceparent(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );

    expect(parsed).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      sampled: true,
    });
  });

  it("rejects invalid and all-zero trace identifiers", () => {
    expect(parseTraceparent("invalid")).toBeNull();
    expect(
      parseTraceparent(
        "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
      ),
    ).toBeNull();
    expect(
      parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01",
      ),
    ).toBeNull();
  });

  it("formats W3C traceparent flags", () => {
    expect(
      formatTraceparent({
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        sampled: false,
      }),
    ).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
    );
  });

  it("normalizes an OTLP HTTP base endpoint to /v1/traces", () => {
    expect(normalizeOtlpTraceEndpoint("http://alloy:4318")).toBe(
      "http://alloy:4318/v1/traces",
    );
    expect(
      normalizeOtlpTraceEndpoint("http://alloy:4318/v1/traces"),
    ).toBe("http://alloy:4318/v1/traces");
  });

  it("only propagates traceparent to explicitly allowed hosts", () => {
    process.env.OTEL_PROPAGATE_HOSTS = "internal-api, worker";

    expect(shouldPropagateTraceToHost("internal-api")).toBe(true);
    expect(shouldPropagateTraceToHost("WORKER")).toBe(true);
    expect(shouldPropagateTraceToHost("api.mercadopago.com")).toBe(false);
  });
});
