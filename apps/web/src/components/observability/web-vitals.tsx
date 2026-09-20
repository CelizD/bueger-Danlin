"use client";

import { apiFetch } from "@/lib/api/browser";
import { normalizeTelemetryRoute } from "@/lib/observability/routes";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    const route = normalizeTelemetryRoute(
      window.location.pathname,
    );

    void apiFetch("/telemetry/web-vitals", {
      method: "POST",
      keepalive: true,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        metricId: metric.id,
        route,
        navigationType: metric.navigationType,
      }),
    }).catch(() => {
      // Telemetry must never break the product experience.
    });
  });

  return null;
}
