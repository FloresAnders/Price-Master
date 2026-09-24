import type { LedgerSyncState } from "../hooks/fondo/useV2MovementsHydration";

const labels: Record<LedgerSyncState, string> = {
  connecting: "Sincronizando saldo…",
  synced: "Saldo actualizado",
  offline: "Saldo sin conexión",
  error: "No se pudo sincronizar el saldo",
};

const colors: Record<LedgerSyncState, string> = {
  connecting: "text-[var(--muted-foreground)]",
  synced: "text-[var(--muted-foreground)]",
  offline: "text-amber-500",
  error: "text-red-500",
};

export function LedgerSyncStatus({ status }: { status: LedgerSyncState }) {
  const label = labels[status];
  return (
    <div role="status" aria-label={label} aria-live="polite" className={`flex items-center gap-2 text-xs ${colors[status]}`}>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full bg-current ${status === "connecting" ? "motion-safe:animate-pulse" : ""}`}
      />
      <span>{label}</span>
    </div>
  );
}
