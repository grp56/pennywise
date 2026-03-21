export function LoadingScreen({ label = "Loading Pennywise..." }: { label?: string }) {
  return (
    <main className="screen-shell screen-shell--centered">
      <section className="glass-panel loading-card">
        <span className="loading-dot" aria-hidden="true" />
        <p className="muted-text">{label}</p>
      </section>
    </main>
  );
}
