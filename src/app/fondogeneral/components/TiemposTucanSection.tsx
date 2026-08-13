export function TiemposTucanSection() {
  return (
    <div className="w-full bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-8">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6 text-center">
        Tiempos/Tucan
      </h2>
      <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-4">
        <section className="min-h-40 rounded-lg border border-[var(--input-border)] bg-[var(--background)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Tiempos
          </h3>
          <p className="text-[var(--muted-foreground)]">
            Management of time tracking and Tucan-related functionalities.
          </p>
        </section>
        <section className="min-h-40 rounded-lg border border-[var(--input-border)] bg-[var(--background)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Tucan
          </h3>
          <p className="text-[var(--muted-foreground)]">
            Management of time tracking and Tucan-related functionalities.
          </p>
        </section>
      </div>
    </div>
  );
}
