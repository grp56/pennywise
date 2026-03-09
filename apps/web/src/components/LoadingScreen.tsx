export function LoadingScreen({ label = "Loading Pennywise..." }: { label?: string }) {
  return (
    <section className="glass-panel empty-state">
      <h2 className="panel-title">{label}</h2>
    </section>
  );
}
