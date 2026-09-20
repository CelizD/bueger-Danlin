"use client";

import { reportClientError } from "@/lib/observability/client-errors";
import { useEffect } from "react";

export function ClientErrorObserver() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError({
        kind: "window-error",
        errorName: event.error instanceof Error
          ? event.error.name
          : "Error",
      });
    }

    function onUnhandledRejection(
      event: PromiseRejectionEvent,
    ) {
      reportClientError({
        kind: "unhandled-rejection",
        errorName:
          event.reason instanceof Error
            ? event.reason.name
            : "UnhandledRejection",
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener(
      "unhandledrejection",
      onUnhandledRejection,
    );

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener(
        "unhandledrejection",
        onUnhandledRejection,
      );
    };
  }, []);

  return null;
}
