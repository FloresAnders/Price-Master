import { Banknote, CheckCircle, FileText, MessageSquare } from "lucide-react";
import type { FacturaMovement } from "../../../../services/facturas";

type PendingCreditInvoicesSectionProps = {
  showPendingClosingCreditInvoices: boolean;
  pendingClosingCreditInvoices: FacturaMovement[];
  providersMap: Map<string, string>;
  dateTimeFormatter: Intl.DateTimeFormat;
  formatByCurrency: (currency: "CRC" | "USD", amount: number) => string;
  onOpenPaymentModal: (invoice: FacturaMovement) => void;
};

export function PendingCreditInvoicesSection({
  showPendingClosingCreditInvoices,
  pendingClosingCreditInvoices,
  providersMap,
  dateTimeFormatter,
  formatByCurrency,
  onOpenPaymentModal,
}: PendingCreditInvoicesSectionProps) {
  if (!showPendingClosingCreditInvoices || pendingClosingCreditInvoices.length === 0) {
    return null;
  }

  return (
    <tbody>
      <tr className="bg-amber-500/10 [&>td]:border-b [&>td]:border-cyan-900/35">
        <td
          colSpan={7}
          className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100"
        >
          Facturas crédito pendientes
        </td>
      </tr>
      {pendingClosingCreditInvoices.map((invoice) => {
        const providerName =
          providersMap.get(invoice.providerCode) ?? invoice.providerCode;
        const totalAmount = Math.max(
          0,
          Math.trunc(Number(invoice.originalAmount ?? invoice.amount) || 0),
        );
        const paidAmount = Math.max(0, Math.trunc(Number(invoice.paidAmount) || 0));
        const balanceAmount = Math.max(
          0,
          Math.trunc(Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0),
        );
        const recordedAt = new Date(invoice.createdAt);
        const formattedInvoiceDate = Number.isNaN(recordedAt.getTime())
          ? "Sin fecha"
          : dateTimeFormatter.format(recordedAt);

        return (
          <tr
            key={invoice.id}
            className="transition-colors hover:bg-amber-500/10 [&>td]:border-b [&>td]:border-cyan-900/35 bg-amber-500/5"
          >
            <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
              {formattedInvoiceDate}
            </td>
            <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
              <div className="font-semibold text-[var(--foreground)]">
                {providerName}
              </div>
              <div className="text-xs text-amber-100/80">
                {invoice.providerCode}
              </div>
              {invoice.notes && (
                <div className="mt-1 flex w-full items-start gap-2 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1.5">
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-[var(--muted-foreground)]" />
                  <span className="break-words text-xs text-[var(--muted-foreground)]">
                    {invoice.notes}
                  </span>
                </div>
              )}
            </td>
            <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
              <div className="flex flex-col gap-1">
                <span className="inline-flex max-w-full items-center rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                  FCR
                </span>
                <span className="text-xs text-amber-100/80">
                  {String(invoice.paymentStatus || "PENDIENTE")}
                </span>
              </div>
            </td>
            <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
              <span className="font-medium text-[var(--foreground)]">
                #{invoice.invoiceNumber}
              </span>
            </td>
            <td className="px-3 py-2 align-top">
              <div className="flex flex-col gap-1 text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className="rounded bg-amber-500/10 px-2 py-1 text-xs font-semibold text-yellow-300">
                    {formatByCurrency(invoice.currency, totalAmount)}
                  </span>
                </div>
                {balanceAmount > 0 ? (
                  <span className="inline-flex items-center justify-end gap-1 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                    <Banknote className="h-3.5 w-3.5" />
                    Saldo: {formatByCurrency(invoice.currency, balanceAmount)}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-end gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Saldado
                  </span>
                )}
                <span className="text-xs text-[var(--muted-foreground)]">
                  Pagado: {formatByCurrency(invoice.currency, paidAmount)}
                </span>
              </div>
            </td>
            <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
              <div className="text-[var(--foreground)]">{invoice.manager || "-"}</div>
              {invoice.manager2 && (
                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Extra: {invoice.manager2}
                </div>
              )}
            </td>
            <td className="px-3 py-2 align-top">
              <button
                type="button"
                onClick={() => {
                  onOpenPaymentModal(invoice);
                }}
                title="Gestionar esta factura desde Facturas de crédito y notas de crédito"
                className="inline-flex items-center gap-1.5 rounded border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-500/20"
              >
                <FileText className="h-4 w-4" />
                Gestionar
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
