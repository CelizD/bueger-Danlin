export default function Loading() {
  return (
    <main
      className="route-state-shell"
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando contenido"
    >
      <div>
        <p className="eyebrow">Burger Danlin</p>
        <div className="route-loading-bar" aria-hidden="true" />
      </div>
    </main>
  );
}
