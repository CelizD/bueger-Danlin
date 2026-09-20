"use client";

import { reportClientError } from "@/lib/observability/client-errors";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      kind: "route-boundary",
      errorName: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="route-state-shell">
      <section className="route-state-card" role="alert">
        <p className="eyebrow">Algo salió mal</p>
        <h1>No pudimos cargar esta parte.</h1>
        <p>
          Puedes intentar nuevamente. Si el problema continúa, vuelve al inicio
          y repite la operación.
        </p>
        <div className="route-state-actions">
          <button type="button" onClick={reset}>
            Reintentar
          </button>
          <a href="/">Volver al inicio</a>
        </div>
      </section>
    </main>
  );
}
