import { apiFetch } from "@/lib/api/browser";
import { normalizeTelemetryRoute } from "./routes";

type ClientErrorKind =
  | "route-boundary"
  | "window-error"
  | "unhandled-rejection";

type ClientErrorInput = {
  kind: ClientErrorKind;
  errorName?: string;
  digest?: string;
};

export function reportClientError(input: ClientErrorInput) {
  if (typeof window === "undefined") return;

  void apiFetch("/telemetry/client-error", {
    method: "POST",
    keepalive: true,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      kind: input.kind,
      errorName: input.errorName?.slice(0, 80),
      digest: input.digest?.slice(0, 120),
      route: normalizeTelemetryRoute(
        window.location.pathname,
      ),
    }),
  }).catch(() => {
    // Observability must never break the app.
  });
}
