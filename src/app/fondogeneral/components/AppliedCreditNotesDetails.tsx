import { CheckCircle, Info } from "lucide-react";
import type { AppliedCreditNote } from "@/services/facturas";

type AppliedCreditNotesDetailsProps = {
  notes: AppliedCreditNote[];
  currency: "CRC" | "USD";
  appliedCreditNotesTotal: number;
  formatByCurrency: (currency: "CRC" | "USD", amount: number) => string;
  variant: "sky" | "emerald";
  colSpan?: number;
};

const VARIANT_STYLES = {
  sky: {
    row: "bg-sky-500/5 [&>td]:border-b [&>td]:border-cyan-900/35",
    wrapper:
      "rounded-lg border border-sky-500/25 border-l-2 border-l-sky-400/60 bg-sky-500/10 p-3 text-xs text-[var(--foreground)]",
    header: "mb-2 flex items-center gap-2 border-b border-sky-500/20 pb-2",
    icon: "text-sky-300",
    divider: "divide-y divide-sky-500/15",
    totalBox:
      "mt-2 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-2 text-right",
    totalValue: "text-base font-semibold text-emerald-400",
  },
  emerald: {
    row: "",
    wrapper: "rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3",
    header:
      "mb-2 flex items-center gap-2 border-b border-emerald-500/15 pb-2 text-emerald-200",
    icon: "",
    divider: "divide-y divide-emerald-500/10",
    totalBox:
      "mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-right",
    totalValue: "text-base font-semibold text-emerald-300",
  },
} as const;

export function AppliedCreditNotesDetails({
  notes,
  currency,
  appliedCreditNotesTotal,
  formatByCurrency,
  variant,
  colSpan,
}: AppliedCreditNotesDetailsProps) {
  const styles = VARIANT_STYLES[variant];

  const content = (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <Info className={`w-4 h-4 ${styles.icon}`.trim()} />
        <span className="font-medium">Notas de crédito aplicadas</span>
      </div>
      <div className={styles.divider}>
        {notes.map((note) => {
          const noteAmount = Math.max(0, Math.trunc(Number(note.amount) || 0));
          const appliedAmount = Math.max(
            0,
            Math.trunc(Number(note.appliedAmount) || 0),
          );
          const noteLabel = note.invoiceNumber
            ? `NC #${note.invoiceNumber}`
            : `NC ${note.id}`;

          return (
            <div key={note.id} className="py-2">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <div className="font-semibold text-[var(--foreground)]">
                    {noteLabel}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Moneda: {note.currency}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[var(--muted-foreground)]">
                    Monto NC:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {formatByCurrency(note.currency, noteAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[var(--muted-foreground)]">
                      Aplicado:
                    </span>
                    <span className="font-medium text-emerald-400">
                      {formatByCurrency(note.currency, appliedAmount)}
                    </span>
                  </div>
                  {note.observation && (
                    <div className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                      Obs: {note.observation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.totalBox}>
        <span className="font-semibold text-[var(--foreground)]">
          Total aplicado:{" "}
        </span>
        <span className={styles.totalValue}>
          {formatByCurrency(currency, appliedCreditNotesTotal)}
        </span>
      </div>
    </div>
  );

  if (colSpan === undefined) {
    return content;
  }

  return (
    <tr className={styles.row}>
      <td colSpan={colSpan} className="px-3 py-2">
        {content}
      </td>
    </tr>
  );
}
