"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { CreditCard, Search } from "lucide-react";
import type { AccountingInvoice } from "@/types/accounting";
import { dateLabel, effectiveStatus, fieldClass, money, statusClass } from "./accountingUi";

type Props = {
  invoices: AccountingInvoice[];
  side: "cliente" | "proveedor";
  onPay: (invoice: AccountingInvoice) => void;
};

export default function InvoiceTable({ invoices, side, onPay }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        const invoiceStatus = effectiveStatus(invoice);
        const matchesStatus = status === "Todos" || invoiceStatus === status;
        const matchesQuery =
          !deferredQuery ||
          invoice.numero.toLowerCase().includes(deferredQuery) ||
          invoice.terceroNombre.toLowerCase().includes(deferredQuery) ||
          invoice.ruta?.toLowerCase().includes(deferredQuery);
        return matchesStatus && matchesQuery;
      }),
    [deferredQuery, invoices, status],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--input-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[var(--foreground)]">Facturas registradas</h2>
          <p className="text-sm text-[var(--muted-foreground)]">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative">
            <span className="sr-only">Buscar factura</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
            <input className={`${fieldClass} pl-9 sm:w-64`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${side === "cliente" ? "cliente" : "proveedor"} o factura`} />
          </label>
          <label>
            <span className="sr-only">Filtrar por estado</span>
            <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              {["Todos", "Pendiente", "Parcial", "Vencida", "Pagada"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="grid min-h-56 place-items-center p-8 text-center">
          <div><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--hover-bg)]"><Search className="h-5 w-5" /></div><p className="font-medium">Sin facturas para mostrar</p><p className="text-sm text-[var(--muted-foreground)]">Prueba otro filtro o registra la primera factura.</p></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-[var(--hover-bg)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr>{["Factura", side === "cliente" ? "Cliente" : "Proveedor", "Emisión", "Vencimiento", "Monto", "Saldo", "Estado", "Acción"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--input-border)]">
              {filtered.map((invoice) => {
                const invoiceStatus = effectiveStatus(invoice);
                return <tr key={invoice.id || invoice.numero} className="transition hover:bg-[var(--hover-bg)]/70">
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{invoice.numero}<div className="mt-0.5 text-xs font-normal text-[var(--muted-foreground)]">{invoice.ruta || invoice.departamento || "Sin referencia"}</div></td>
                  <td className="px-4 py-3">{invoice.terceroNombre}</td><td className="px-4 py-3">{dateLabel(invoice.fechaEmision)}</td><td className="px-4 py-3">{dateLabel(invoice.fechaVencimiento)}</td><td className="px-4 py-3 font-medium">{money(invoice.monto, invoice.moneda)}</td><td className="px-4 py-3 font-semibold">{money(invoice.saldo, invoice.moneda)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[invoiceStatus]}`}>{invoiceStatus}</span></td>
                  <td className="px-4 py-3"><button type="button" disabled={invoiceStatus === "Pagada"} onClick={() => onPay(invoice)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:cursor-not-allowed disabled:opacity-40"><CreditCard className="h-4 w-4" />Aplicar pago</button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
