"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Banknote, CreditCard, FileUp, Landmark, Printer, X } from "lucide-react";
import type { AccountingInvoice, AccountingPayment } from "@/types/accounting";
import { dateLabel, fieldClass, money, primaryButton, secondaryButton, todayKey } from "./accountingUi";

type PaymentDraft = { monto: number; metodo: AccountingPayment["metodo"]; fechaPago: string; notas: string; file?: File };
type Props = { invoice: AccountingInvoice; busy: boolean; onClose: () => void; onSubmit: (draft: PaymentDraft) => Promise<void> };
const methods = [{ id: "efectivo", label: "Efectivo", icon: Banknote }, { id: "transferencia", label: "Transferencia", icon: Landmark }, { id: "cheque", label: "Cheque", icon: CreditCard }] as const;

export default function PaymentModal({ invoice, busy, onClose, onSubmit }: Props) {
  const amountRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [draft, setDraft] = useState<PaymentDraft>({ monto: invoice.saldo, metodo: "efectivo", fechaPago: todayKey(), notas: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); await onSubmit(draft); };
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    amountRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); opener?.focus(); };
  }, []);

  const printReceipt = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a5" });
    doc.setFontSize(17); doc.text(invoice.tipo === "cliente" ? "Comprobante de pago" : "Comprobante a proveedor", 14, 18);
    doc.setFontSize(10);
    const lines = [
      `Factura: ${invoice.numero}`,
      `${invoice.tipo === "cliente" ? "Cliente" : "Proveedor"}: ${invoice.terceroNombre}`,
      `Monto del pago: ${money(draft.monto, invoice.moneda)}`,
      `Método: ${draft.metodo}`,
      `Fecha: ${draft.fechaPago}`,
      `Saldo anterior: ${money(invoice.saldo, invoice.moneda)}`,
      `Saldo posterior: ${money(Math.max(0, invoice.saldo - draft.monto), invoice.moneda)}`,
      ...(draft.notas ? [`Notas: ${draft.notas}`] : []),
    ];
    doc.text(lines, 14, 31, { maxWidth: 120 });
    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank", "noopener,noreferrer");
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="payment-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
      <div className="flex items-start justify-between border-b border-[var(--input-border)] p-5"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--primary)]">Aplicar pago</p><h2 id="payment-title" className="mt-1 text-xl font-bold">Factura {invoice.numero}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--hover-bg)]" aria-label="Cerrar"><X /></button></div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-[var(--hover-bg)] p-5 text-sm"><Summary label={invoice.tipo === "cliente" ? "Cliente" : "Proveedor"} value={invoice.terceroNombre} /><Summary label="Monto total" value={money(invoice.monto, invoice.moneda)} /><Summary label="Saldo pendiente" value={money(invoice.saldo, invoice.moneda)} danger /><Summary label="Vencimiento" value={dateLabel(invoice.fechaVencimiento)} /></div>
      <div className="grid gap-4 p-5">
        <label className="grid gap-1.5 text-sm font-medium">Monto a pagar<input ref={amountRef} required type="number" min="0.01" max={invoice.saldo} step="0.01" className={fieldClass} value={draft.monto || ""} onChange={(e) => setDraft((d) => ({ ...d, monto: Number(e.target.value) }))} /><span className="text-xs font-normal text-[var(--muted-foreground)]">Máximo: {money(invoice.saldo, invoice.moneda)}</span></label>
        <fieldset><legend className="mb-2 text-sm font-medium">Método de pago</legend><div className="grid grid-cols-3 gap-2">{methods.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={draft.metodo === id} onClick={() => setDraft((d) => ({ ...d, metodo: id }))} className={`grid place-items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition ${draft.metodo === id ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--input-border)] hover:bg-[var(--hover-bg)]"}`}><Icon className="h-4 w-4" />{label}</button>)}</div></fieldset>
        <label className="grid gap-1.5 text-sm font-medium">Fecha de pago<input required type="date" className={fieldClass} value={draft.fechaPago} onChange={(e) => setDraft((d) => ({ ...d, fechaPago: e.target.value }))} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Notas <span className="sr-only">opcionales</span><textarea rows={3} className={fieldClass} placeholder="Información adicional del pago…" value={draft.notas} onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))} /></label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--input-border)] p-3 text-sm hover:bg-[var(--hover-bg)]"><FileUp className="h-5 w-5 text-[var(--primary)]" /><span className="min-w-0 flex-1 truncate">{draft.file?.name || "Adjuntar comprobante (opcional)"}</span><input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => setDraft((d) => ({ ...d, file: e.target.files?.[0] }))} /></label>
      </div>
      <div className="grid gap-2 border-t border-[var(--input-border)] p-5 sm:grid-cols-[auto_1fr_1fr]"><button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button><button type="button" onClick={() => void printReceipt()} className={secondaryButton}><Printer className="h-4 w-4" />Comprobante</button><button disabled={busy} className={primaryButton}>{busy ? "Procesando…" : "Confirmar pago"}</button></div>
    </form>
  </div>;
}

function Summary({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <div><p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p><p className={`mt-1 font-semibold ${danger ? "text-rose-500" : "text-[var(--foreground)]"}`}>{value}</p></div>; }
