interface TransactionFormPageProps {
  mode: "create" | "edit";
}

export function TransactionFormPage({ mode }: TransactionFormPageProps) {
  return (
    <section className="glass-panel empty-state">
      <h2 className="panel-title">{mode === "edit" ? "Edit" : "Create"} transaction</h2>
      <p className="muted-text">The form shell arrives in the next commit.</p>
    </section>
  );
}
