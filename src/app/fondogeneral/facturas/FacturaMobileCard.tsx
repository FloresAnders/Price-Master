import type { ReactNode } from "react";

import { MobileRecordCard } from "../components/MobileRecordCard";

export type FacturaMobileCardProps = {
  ariaLabel: string;
  providerName: string;
  providerCode: string;
  date: string;
  time: string;
  amountLabel: string;
  currency: string;
  documentTypeLabel: string;
  statusLabel: string;
  statusToneClassName: string;
  balanceLabel?: string;
  invoiceNumber: string;
  manager: string;
  notes: string;
  paymentTypeLabel: string;
  actions?: ReactNode;
};

export function FacturaMobileCard({
  ariaLabel,
  providerName,
  providerCode,
  date,
  time,
  amountLabel,
  currency,
  documentTypeLabel,
  statusLabel,
  statusToneClassName,
  balanceLabel,
  invoiceNumber,
  manager,
  notes,
  paymentTypeLabel,
  actions,
}: FacturaMobileCardProps) {
  return (
    <MobileRecordCard
      ariaLabel={ariaLabel}
      title={providerName}
      subtitle={providerCode}
      dateTime={
        <span className="flex flex-col">
          <span>{date}</span>
          <span>{time}</span>
        </span>
      }
      amount={
        <span className="flex flex-wrap items-baseline gap-1.5">
          <span>{amountLabel}</span>
          <span className="text-xs font-medium text-[var(--muted-foreground)]">
            {currency}
          </span>
        </span>
      }
      badges={
        <>
          <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-1 text-xs font-medium text-[var(--foreground)]">
            {documentTypeLabel}
          </span>
          <span
            className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusToneClassName}`}
          >
            {statusLabel}
          </span>
          {balanceLabel ? (
            <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
              <span>Saldo</span>
              <span>{balanceLabel}</span>
            </span>
          ) : null}
        </>
      }
      details={[
        { label: "N.º factura", value: invoiceNumber || "-" },
        { label: "Encargado", value: manager || "-" },
        { label: "Tipo de pago", value: paymentTypeLabel || "-" },
        { label: "Observación", value: notes || "-" },
      ]}
      actions={actions}
    />
  );
}
