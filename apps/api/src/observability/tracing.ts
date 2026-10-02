import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

type TraceContext = {
  traceId: string;
  spanId: string;
  sampled: boolean;
};

type ParsedTraceparent = TraceContext;

type OtlpAttributeValue =
  | { stringValue: string }
  | { intValue: string }
  | { doubleValue: number }
  | { boolValue: boolean };

type OtlpAttribute = {
  key: string;
  value: OtlpAttributeValue;
};

type SpanRecord = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 2 | 3;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  status: {
    code: 0 | 1 | 2;
  };
};

const storage = new AsyncLocalStorage<TraceContext>();
const nativeFetch = globalThis.fetch.bind(globalThis);
let outboundFetchInstalled = false;
let lastExporterWarningAt = 0;

function randomHex(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

function nowUnixNano() {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

function isZeroHex(value: string) {
  return /^0+$/.test(value);
}

function configuredSampleRatio() {
  const parsed = Number(process.env.OTEL_TRACE_SAMPLE_RATIO ?? "1");

  if (!Number.isFinite(parsed)) return 1;

  return Math.min(1, Math.max(0, parsed));
}

function shouldSample(traceId: string) {
  const ratio = configuredSampleRatio();

  if (ratio <= 0) return false;
  if (ratio >= 1) return true;

  const prefix = Number.parseInt(traceId.slice(0, 8), 16);
  return prefix / 0xffffffff < ratio;
}

function tracingEnabled() {
  return process.env.OTEL_TRACING_ENABLED === "true";
}

function attribute(key: string, value: string | number | boolean) {
  let otlpValue: OtlpAttributeValue;

  if (typeof value === "string") {
    otlpValue = { stringValue: value };
  } else if (typeof value === "boolean") {
    otlpValue = { boolValue: value };
  } else if (Number.isInteger(value)) {
    otlpValue = { intValue: String(value) };
  } else {
    otlpValue = { doubleValue: value };
  }

  return { key, value: otlpValue };
}

export function parseTraceparent(value: string | undefined): ParsedTraceparent | null {
  if (!value) return null;

  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(
    value.trim(),
  );

  if (!match) return null;

  const traceId = match[1]!.toLowerCase();
  const spanId = match[2]!.toLowerCase();
  const flags = Number.parseInt(match[3]!, 16);

  if (isZeroHex(traceId) || isZeroHex(spanId)) {
    return null;
  }

  return {
    traceId,
    spanId,
    sampled: (flags & 0x01) === 0x01,
  };
}

export function formatTraceparent(context: TraceContext) {
  const flags = context.sampled ? "01" : "00";
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

export function normalizeOtlpTraceEndpoint(value?: string) {
  const raw = value?.trim() || "http://alloy:4318/v1/traces";
  const url = new URL(raw);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("OTLP trace endpoint must use HTTP or HTTPS.");
  }

  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = "/v1/traces";
  }

  return url.toString();
}

function propagationHosts() {
  return new Set(
    (process.env.OTEL_PROPAGATE_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function shouldPropagateTraceToHost(hostname: string) {
  return propagationHosts().has(hostname.toLowerCase());
}

function exporterWarning(error: unknown) {
  const now = Date.now();

  if (now - lastExporterWarningAt < 60_000) return;
  lastExporterWarningAt = now;

  const message =
    error instanceof Error ? error.message : "unknown exporter error";
  console.warn(
    `OpenTelemetry trace export failed: ${message.slice(0, 180)}`,
  );
}

async function exportSpan(span: SpanRecord) {
  if (!span || !tracingEnabled()) return;

  let endpoint: string;

  try {
    endpoint = normalizeOtlpTraceEndpoint(
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    );
  } catch (error) {
    exporterWarning(error);
    return;
  }

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            attribute(
              "service.name",
              process.env.OTEL_SERVICE_NAME ?? "burger-danlin-api",
            ),
            attribute(
              "deployment.environment",
              process.env.NODE_ENV ?? "development",
            ),
            attribute("service.version", "0.1.0"),
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: "burger-danlin-api",
              version: "1",
            },
            spans: [span],
          },
        ],
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  timeout.unref?.();

  try {
    const response = await nativeFetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OTLP HTTP ${response.status}`);
    }
  } catch (error) {
    exporterWarning(error);
  } finally {
    clearTimeout(timeout);
  }
}

function emitSpan(span: SpanRecord) {
  if (!tracingEnabled()) return;
  void exportSpan(span);
}

export function createServerHttpSpan(input: {
  method: string;
  incomingTraceparent?: string;
  requestId: string;
}) {
  if (!tracingEnabled()) return null;

  const incoming = parseTraceparent(input.incomingTraceparent);
  const traceId = incoming?.traceId ?? randomHex(16);
  const context: TraceContext = {
    traceId,
    spanId: randomHex(8),
    sampled: incoming?.sampled ?? shouldSample(traceId),
  };
  const parentSpanId = incoming?.spanId;
  const startedAt = nowUnixNano();
  let ended = false;

  return {
    traceId,
    traceparent: formatTraceparent(context),
    run<T>(fn: () => T) {
      return storage.run(context, fn);
    },
    end(result: { route: string; statusCode: number }) {
      if (ended || !context.sampled) return;
      ended = true;

      emitSpan({
        traceId: context.traceId,
        spanId: context.spanId,
        parentSpanId,
        name: `${input.method.toUpperCase()} ${result.route}`,
        kind: 2,
        startTimeUnixNano: startedAt,
        endTimeUnixNano: nowUnixNano(),
        attributes: [
          attribute("http.request.method", input.method.toUpperCase()),
          attribute("http.route", result.route),
          attribute("http.response.status_code", result.statusCode),
          attribute("app.request_id", input.requestId),
        ],
        status: {
          code: result.statusCode >= 500 ? 2 : 1,
        },
      });
    },
  };
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.method.toUpperCase();
  }

  return "GET";
}

export function installOutboundHttpTracing() {
  if (!tracingEnabled() || outboundFetchInstalled) return;

  outboundFetchInstalled = true;

  const tracedFetch: typeof globalThis.fetch = async (input, init) => {
    const parent = storage.getStore();

    if (!parent) {
      return nativeFetch(input, init);
    }

    let url: URL;

    try {
      url = new URL(requestUrl(input));
    } catch {
      return nativeFetch(input, init);
    }

    const child: TraceContext = {
      traceId: parent.traceId,
      spanId: randomHex(8),
      sampled: parent.sampled,
    };
    const method = requestMethod(input, init);
    const startedAt = nowUnixNano();
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (shouldPropagateTraceToHost(url.hostname)) {
      headers.set("traceparent", formatTraceparent(child));
    }

    try {
      const response = await storage.run(child, () =>
        nativeFetch(input, {
          ...init,
          headers,
        }),
      );

      if (child.sampled) {
        emitSpan({
          traceId: child.traceId,
          spanId: child.spanId,
          parentSpanId: parent.spanId,
          name: `HTTP ${method} ${url.hostname}`,
          kind: 3,
          startTimeUnixNano: startedAt,
          endTimeUnixNano: nowUnixNano(),
          attributes: [
            attribute("http.request.method", method),
            attribute("server.address", url.hostname),
            attribute(
              "server.port",
              Number(url.port || (url.protocol === "https:" ? 443 : 80)),
            ),
            attribute("url.scheme", url.protocol.replace(":", "")),
            attribute("http.response.status_code", response.status),
          ],
          status: {
            code: response.status >= 400 ? 2 : 1,
          },
        });
      }

      return response;
    } catch (error) {
      if (child.sampled) {
        emitSpan({
          traceId: child.traceId,
          spanId: child.spanId,
          parentSpanId: parent.spanId,
          name: `HTTP ${method} ${url.hostname}`,
          kind: 3,
          startTimeUnixNano: startedAt,
          endTimeUnixNano: nowUnixNano(),
          attributes: [
            attribute("http.request.method", method),
            attribute("server.address", url.hostname),
            attribute(
              "server.port",
              Number(url.port || (url.protocol === "https:" ? 443 : 80)),
            ),
            attribute("url.scheme", url.protocol.replace(":", "")),
          ],
          status: {
            code: 2,
          },
        });
      }

      throw error;
    }
  };

  globalThis.fetch = tracedFetch;
}
