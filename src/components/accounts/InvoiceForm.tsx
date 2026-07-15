"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FilePlus2, X } from "lucide-react";
import type { AccountingCurrency } from "@/types/accounting";
import { fieldClass, primaryButton, secondaryButton, todayKey } from "./accountingUi";

type Draft = { numero: string; terceroNombre: string; ruta?: string; departamento?: string; fechaEmision: string; fechaVencimiento: string; monto: number; moneda: AccountingCurrency };
type Props = { side: "cliente" | "proveedor"; busy: boolean; onClose: () => void; onSubmit: (draft: Draft) => Promise<void> };

export default function InvoiceForm({ side, busy, onClose, onSubmit }: Props) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const today = todayKey();
  const [draft, setDraft] = useState<Draft>({ numero: "", terceroNombre: "", ruta: "", departamento: "", fechaEmision: today, fechaVencimiento: today, monto: 0, moneda: "CRC" });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); await onSubmit(draft); };

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstFieldRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); opener?.focus(); };
  }, []);

  return <div role="dialog" aria-modal="true" aria-labelledby="invoice-form-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--input-border)] bg-[var(--card-bg)] px-5 py-4"><div className="flex gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]"><FilePlus2 /></div><div><h2 id="invoice-form-title" className="text-lg font-bold">Nueva factura</h2><p className="text-sm text-[var(--muted-foreground)]">{side === "cliente" ? "Cuenta por cobrar" : "Cuenta por pagar"}</p></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--hover-bg)]" aria-label="Cerrar"><X /></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Número de factura"><input ref={firstFieldRef} required className={fieldClass} value={draft.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
        <Field label={side === "cliente" ? "Cliente" : "Proveedor"}><input required className={fieldClass} value={draft.terceroNombre} onChange={(e) => set("terceroNombre", e.target.value)} /></Field>
        {side === "cliente" ? <><Field label="Ruta"><input className={fieldClass} value={draft.ruta} onChange={(e) => set("ruta", e.target.value)} /></Field><Field label="Departamento"><input className={fieldClass} value={draft.departamento} onChange={(e) => set("departamento", e.target.value)} /></Field></> : null}
        <Field label="Fecha de emisión"><input required type="date" className={fieldClass} value={draft.fechaEmision} onChange={(e) => set("fechaEmision", e.target.value)} /></Field>
        <Field label="Fecha de vencimiento"><input required type="date" min={draft.fechaEmision} className={fieldClass} value={draft.fechaVencimiento} onChange={(e) => set("fechaVencimiento", e.target.value)} /></Field>
        <Field label="Monto"><input required type="number" min="0.01" step="0.01" className={fieldClass} value={draft.monto || ""} onChange={(e) => set("monto", Number(e.target.value))} /></Field>
        <Field label="Moneda"><select className={fieldClass} value={draft.moneda} onChange={(e) => set("moneda", e.target.value as Draft["moneda"])}><option value="CRC">Colones (CRC)</option><option value="USD">Dólares (USD)</option></select></Field>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[var(--input-border)] p-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className={secondaryButton}>Cancelar</button><button disabled={busy} className={primaryButton}>{busy ? "Guardando…" : "Registrar factura"}</button></div>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]">{label}{children}</label>; }
