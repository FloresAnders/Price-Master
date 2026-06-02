"use client";

const movementSkeletonRows = Array.from({ length: 8 }, (_, index) => index);

export function FondoMovementsSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
      {!compact && (
        <div className="flex flex-col gap-3 border-b border-[var(--input-border)] bg-[var(--muted)]/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-cyan-100/10" />
            <div className="h-9 w-28 animate-pulse rounded bg-cyan-100/10" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-36 animate-pulse rounded bg-cyan-100/10" />
            <div className="h-9 w-24 animate-pulse rounded bg-cyan-100/10" />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs sm:text-sm">
          <thead className="bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
            <tr>
              {[
                "Hora",
                "Motivo",
                "Tipo",
                "NÂ° factura",
                "Monto",
                "Encargado",
                "",
              ].map((label) => (
                <th
                  key={label || "acciones"}
                  className="px-3 py-2 text-left font-semibold"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-cyan-500/5">
              <td colSpan={7} className="px-3 py-2">
                <div className="h-4 w-40 animate-pulse rounded bg-cyan-100/10" />
              </td>
            </tr>
            {movementSkeletonRows.map((row) => (
              <tr
                key={row}
                className="[&>td]:border-b [&>td]:border-cyan-900/35"
              >
                <td className="px-3 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-2">
                    <div className="h-4 w-36 animate-pulse rounded bg-cyan-100/10" />
                    <div className="h-3 w-48 animate-pulse rounded bg-cyan-100/5" />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="h-6 w-28 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="ml-auto h-6 w-24 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="ml-auto h-8 w-20 animate-pulse rounded bg-cyan-100/10" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
