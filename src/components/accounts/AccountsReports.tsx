"use client";

import { CalendarClock, FileDown, FileSpreadsheet, History, Scale } from "lucide-react";
import type { AccountingCurrency, AccountingInvoice, AccountingPayment } from "@/types/accounting";
import { dateKey, dateLabel, effectiveStatus, money, secondaryButton, sumByCurrency, todayKey, type CurrencyTotals } from "./accountingUi";

type Props = { invoices: AccountingInvoice[]; payments: AccountingPayment[] };

export default function AccountsReports({ invoices, payments }: Props) {
  const receivable = sumByCurrency(invoices.filter((x) => x.tipo === "cliente"));
  const payable = sumByCurrency(invoices.filter((x) => x.tipo === "proveedor"));
  const overdue = invoices.filter((x) => effectiveStatus(x) === "Vencida");
  const scheduled = invoices
    .filter((x) => x.tipo === "proveedor" && x.saldo > 0)
    .toSorted((a, b) => dateKey(a.fechaVencimiento).localeCompare(dateKey(b.fechaVencimiento)));
  const recentPayments = payments
    .toSorted((a, b) => dateKey(b.fechaPago).localeCompare(dateKey(a.fechaPago)))
    .slice(0, 20);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const invoiceRows = invoices.map((x) => ({ Tipo: x.tipo, Factura: x.numero, Tercero: x.terceroNombre, Emisión: dateLabel(x.fechaEmision), Vencimiento: dateLabel(x.fechaVencimiento), Monto: x.monto, Pagado: x.pagado, Saldo: x.saldo, Moneda: x.moneda, Estado: effectiveStatus(x) }));
    const paymentRows = payments.map((x) => ({ Tipo: x.tipo, Factura: x.numeroFactura, Tercero: x.terceroNombre, Fecha: dateLabel(x.fechaPago), Monto: x.monto, Método: x.metodo }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(invoiceRows), "Facturas");
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(paymentRows), "Pagos");
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(scheduled.map((x) => ({ Factura: x.numero, Proveedor: x.terceroNombre, Vencimiento: dateLabel(x.fechaVencimiento), Saldo: x.saldo, Moneda: x.moneda }))), "Flujo programado");
    XLSX.writeFile(book, `cuentas-${todayKey()}.xlsx`);
  };

  const exportPdf = async () => {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18); doc.text("Reporte de cuentas", 14, 16);
    autoTableModule.default(doc, { startY: 22, head: [["Tipo", "Factura", "Tercero", "Vencimiento", "Monto", "Saldo", "Estado"]], body: invoices.map((x) => [x.tipo, x.numero, x.terceroNombre, dateLabel(x.fechaVencimiento), money(x.monto, x.moneda), money(x.saldo, x.moneda), effectiveStatus(x)]) });
    doc.save(`cuentas-${todayKey()}.pdf`);
  };

  return <div className="grid gap-5">
    <section className="rounded-3xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--primary)]">Reportes</p><h2 className="mt-1 text-xl font-bold">Balance por moneda</h2></div><div className="flex gap-2"><button className={secondaryButton} onClick={() => void exportPdf()}><FileDown className="h-4 w-4" />PDF</button><button className={secondaryButton} onClick={() => void exportExcel()}><FileSpreadsheet className="h-4 w-4" />Excel</button></div></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2"><CurrencyBalance currency="CRC" receivable={receivable} payable={payable} /><CurrencyBalance currency="USD" receivable={receivable} payable={payable} /></div>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--input-border)] p-4"><Scale className="h-5 w-5 text-[var(--primary)]" /><div><p className="text-sm text-[var(--muted-foreground)]">Pagos registrados</p><p className="font-bold">{payments.length}</p></div></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <ReportList icon={CalendarClock} title="Flujo de pagos programados" subtitle={`${scheduled.length} facturas de proveedor abiertas`} empty="No hay pagos programados.">
        {scheduled.map((x) => <ReportRow key={x.id} title={`${x.numero} · ${x.terceroNombre}`} detail={`Vence ${dateLabel(x.fechaVencimiento)} · ${effectiveStatus(x)}`} amount={money(x.saldo, x.moneda)} danger={effectiveStatus(x) === "Vencida"} />)}
      </ReportList>
      <ReportList icon={History} title="Historial de pagos" subtitle={`${payments.length} pagos registrados`} empty="No hay pagos registrados.">
        {recentPayments.map((x) => <ReportRow key={x.id} title={`${x.numeroFactura} · ${x.terceroNombre}`} detail={`${dateLabel(x.fechaPago)} · ${x.metodo}`} amount={money(x.monto, currencyForPayment(x, invoices))} />)}
      </ReportList>
    </div>

    <ReportList icon={Scale} title="Facturas vencidas" subtitle={`${overdue.length} requieren atención`} empty="No hay facturas vencidas.">
      {overdue.map((x) => <ReportRow key={x.id} title={`${x.numero} · ${x.terceroNombre}`} detail={`Venció ${dateLabel(x.fechaVencimiento)}`} amount={money(x.saldo, x.moneda)} danger />)}
    </ReportList>
  </div>;
}

function CurrencyBalance({ currency, receivable, payable }: { currency: AccountingCurrency; receivable: CurrencyTotals; payable: CurrencyTotals }) {
  const incoming = receivable[currency];
  const outgoing = payable[currency];
  const scale = Math.max(incoming, outgoing, 1);
  return <article className="rounded-2xl border border-[var(--input-border)] bg-[var(--hover-bg)] p-5"><div className="flex items-center justify-between"><h3 className="font-bold">{currency === "CRC" ? "Colones" : "Dólares"}</h3><span className="rounded-full bg-[var(--card-bg)] px-2.5 py-1 text-xs font-bold">{currency}</span></div><div className="mt-5 grid gap-4"><BalanceLine label="Por cobrar" value={incoming} currency={currency} width={(incoming / scale) * 100} color="bg-[var(--primary)]" /><BalanceLine label="Por pagar" value={outgoing} currency={currency} width={(outgoing / scale) * 100} color="bg-amber-500" /></div><div className="mt-5 border-t border-[var(--input-border)] pt-4"><p className="text-xs text-[var(--muted-foreground)]">Balance neto</p><p className={`mt-1 text-xl font-black ${incoming - outgoing < 0 ? "text-rose-500" : "text-emerald-600"}`}>{money(incoming - outgoing, currency)}</p></div></article>;
}

function BalanceLine({ label, value, currency, width, color }: { label: string; value: number; currency: AccountingCurrency; width: number; color: string }) { return <div><div className="mb-1.5 flex justify-between gap-3 text-sm"><span>{label}</span><strong>{money(value, currency)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[var(--card-bg)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>; }
function currencyForPayment(payment: AccountingPayment, _invoices: AccountingInvoice[]): AccountingCurrency { return payment.moneda; }
function ReportList({ icon: Icon, title, subtitle, empty, children }: { icon: typeof Scale; title: string; subtitle: string; empty: string; children: React.ReactNode }) { const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children); return <section className="overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)]"><div className="flex items-center gap-3 border-b border-[var(--input-border)] p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><Icon className="h-4 w-4" /></span><div><h3 className="font-semibold">{title}</h3><p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p></div></div>{hasContent ? <div className="max-h-96 divide-y divide-[var(--input-border)] overflow-y-auto">{children}</div> : <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">{empty}</p>}</section>; }
function ReportRow({ title, detail, amount, danger }: { title: string; detail: string; amount: string; danger?: boolean }) { return <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{title}</p><p className="text-sm text-[var(--muted-foreground)]">{detail}</p></div><p className={`font-bold ${danger ? "text-rose-500" : ""}`}>{amount}</p></div>; }
