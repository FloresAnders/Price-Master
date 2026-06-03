import { Info } from "lucide-react";
import type { AppliedCreditNote } from "@/services/facturas";
import { AppliedCreditNotesDetails } from "./AppliedCreditNotesDetails";

type PaidFcrInfoRowProps = {
  primaryManager: string | null | undefined;
  formattedDate: string;
  manager: string | null | undefined;
  formattedOriginalRegisteredAt: string;
  originalFcrAmount: number | null;
  owedFcrAmount: number | null;
  entryCurrency: "CRC" | "USD";
  hasAppliedCreditNotes: boolean;
  appliedCreditNotes: AppliedCreditNote[];
  appliedCreditNotesTotal: number;
  formatByCurrency: (currency: "CRC" | "USD", amount: number) => string;
  colSpan: number;
};

export function PaidFcrInfoRow({
  primaryManager,
  formattedDate,
  manager,
  formattedOriginalRegisteredAt,
  originalFcrAmount,
  owedFcrAmount,
  entryCurrency,
  hasAppliedCreditNotes,
  appliedCreditNotes,
  appliedCreditNotesTotal,
  formatByCurrency,
  colSpan,
}: PaidFcrInfoRowProps) {
  return (
    <tr className="bg-emerald-500/5 [&>td]:border-b [&>td]:border-cyan-900/35">
      <td colSpan={colSpan} className="px-3 py-2">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-[var(--foreground)]">
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Info className="w-4 h-4" />
            <span className="font-semibold">
              Detalle de Factura Credito pagada
            </span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div>
              <span className="text-[var(--muted-foreground)]">
                Encargado de pago:
              </span>{" "}
              <span className="font-medium">{primaryManager || "-"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">
                Fecha de pago:
              </span>{" "}
              <span className="font-medium">{formattedDate}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">
                Registró factura:
              </span>{" "}
              <span className="font-medium">{manager || "-"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">
                Fecha registro factura:
              </span>{" "}
              <span className="font-medium">{formattedOriginalRegisteredAt}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">
                Monto factura original:
              </span>{" "}
              <span className="font-medium">
                {originalFcrAmount === null
                  ? "-"
                  : formatByCurrency(entryCurrency, originalFcrAmount)}
              </span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">
                Monto adeudado:
              </span>{" "}
              <span className="font-medium">
                {owedFcrAmount === null
                  ? "-"
                  : formatByCurrency(entryCurrency, owedFcrAmount)}
              </span>
            </div>
          </div>
          {hasAppliedCreditNotes && (
            <div className="mt-3">
              <AppliedCreditNotesDetails
                notes={appliedCreditNotes}
                currency={entryCurrency}
                appliedCreditNotesTotal={appliedCreditNotesTotal}
                formatByCurrency={formatByCurrency}
                variant="emerald"
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
