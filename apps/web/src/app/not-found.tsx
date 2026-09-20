export default function NotFound() {
  return (
    <main className="route-state-shell">
      <section className="route-state-card">
        <p className="eyebrow">404</p>
        <h1>Esta página no existe.</h1>
        <p>
          El enlace puede haber cambiado o ya no estar disponible.
        </p>
        <div className="route-state-actions">
          <a href="/">Volver al inicio</a>
        </div>
      </section>
    </main>
  );
}
