"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
