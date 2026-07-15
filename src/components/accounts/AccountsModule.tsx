"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CircleDollarSign, FilePlus2, RefreshCw, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import useToast from "@/hooks/useToast";
import type { AccountingInvoice, AccountingPayment, CreateAccountingInvoiceInput } from "@/types/accounting";
import { applyPaymentClient, createInvoice, subscribeInvoices, subscribePayments, uploadPaymentReceipt } from "@/services/accounting";
import AccountsReports from "./AccountsReports";
import InvoiceForm from "./InvoiceForm";
import InvoiceTable from "./InvoiceTable";
import PaymentModal from "./PaymentModal";
import { dateKey, effectiveStatus, money, primaryButton, sumByCurrency, todayKey, type CurrencyTotals } from "./accountingUi";

type Tab = "resumen" | "cobrar" | "pagar" | "reportes";
type Side = "cliente" | "proveedor";
const tabs: { id: Tab; label: string }[] = [{ id: "resumen", label: "Resumen" }, { id: "cobrar", label: "Por cobrar" }, { id: "pagar", label: "Por pagar" }, { id: "reportes", label: "Reportes" }];

export default function AccountsModule() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("resumen");
  const [clientInvoices, setClientInvoices] = useState<AccountingInvoice[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<AccountingInvoice[]>([]);
  const [clientPayments, setClientPayments] = useState<AccountingPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<AccountingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formSide, setFormSide] = useState<Side | null>(null);
  const [paying, setPaying] = useState<AccountingInvoice | null>(null);
  const ownerId = user?.ownerId || user?.id || "";
  const empresaId = user?.ownercompanie || ownerId;

  useEffect(() => {
    if (!ownerId || !empresaId) { setLoading(false); return; }
    setLoading(true); setError("");
    let received = 0;
    const ready = () => { received += 1; if (received >= 4) setLoading(false); };
    const fail = (reason: Error) => {
      const message = reason.message || "No fue posible cargar las cuentas.";
      setError(
        message.includes("requires an index")
          ? "Falta publicar un índice de Firestore para esta consulta. Revisa firestore.indexes.json."
          : message,
      );
      setLoading(false);
    };
    const unsubscribers = [
      subscribeInvoices({ tipo: "cliente", ownerId, empresaId }, (data) => { setClientInvoices(data); ready(); }, fail),
      subscribeInvoices({ tipo: "proveedor", ownerId, empresaId }, (data) => { setSupplierInvoices(data); ready(); }, fail),
      subscribePayments({ tipo: "cliente", ownerId, empresaId }, (data) => { setClientPayments(data); ready(); }, fail),
      subscribePayments({ tipo: "proveedor", ownerId, empresaId }, (data) => { setSupplierPayments(data); ready(); }, fail),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [empresaId, ownerId]);

  const invoices = useMemo(() => [...clientInvoices, ...supplierInvoices], [clientInvoices, supplierInvoices]);
  const payments = useMemo(() => [...clientPayments, ...supplierPayments], [clientPayments, supplierPayments]);
  const metrics = useMemo(() => {
    const open = (items: AccountingInvoice[]) => sumByCurrency(items);
    const overdue = (items: AccountingInvoice[]) => sumByCurrency(items.filter((x) => effectiveStatus(x) === "Vencida"));
    const today = (items: AccountingInvoice[]) => sumByCurrency(items.filter((x) => x.estado !== "Pagada" && invoiceDateKey(x) === todayKey()));
    const upcoming = sumByCurrency(supplierInvoices.filter((x) => x.estado !== "Pagada" && daysUntil(x) >= 0 && daysUntil(x) <= 7));
    return { receivable: open(clientInvoices), payable: open(supplierInvoices), clientOverdue: overdue(clientInvoices), supplierOverdue: overdue(supplierInvoices), today: today(clientInvoices), upcoming };
  }, [clientInvoices, supplierInvoices]);

  const addInvoice = async (draft: Parameters<React.ComponentProps<typeof InvoiceForm>["onSubmit"]>[0]) => {
    if (!formSide || !user?.id) return;
    setBusy(true);
    try {
      const terceroId = draft.terceroNombre.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID();
      const input: CreateAccountingInvoiceInput = { ...draft, fechaEmision: crDate(draft.fechaEmision), fechaVencimiento: crDate(draft.fechaVencimiento), tipo: formSide, ownerId, empresaId, createdBy: user.id, terceroId };
      await createInvoice(input); setFormSide(null); showToast("Factura registrada.", "success");
    } catch (reason) { showToast(reason instanceof Error ? reason.message : "No se pudo registrar la factura.", "error"); } finally { setBusy(false); }
  };

  const applyPayment = async (draft: Parameters<React.ComponentProps<typeof PaymentModal>["onSubmit"]>[0]) => {
    if (!paying?.id || !user?.id) return;
    setBusy(true);
    try {
      let comprobantePath: string | undefined;
      if (draft.file) comprobantePath = (await uploadPaymentReceipt({ ownerId, empresaId, tipo: paying.tipo, facturaId: paying.id, file: draft.file, fileName: draft.file.name })).path;
      await applyPaymentClient({ tipo: paying.tipo, facturaId: paying.id, ownerId, empresaId, createdBy: user.id, monto: draft.monto, metodo: draft.metodo, fechaPago: crDate(draft.fechaPago), notas: draft.notas, comprobantePath });
      setPaying(null); showToast("Pago aplicado correctamente.", "success");
    } catch (reason) { showToast(reason instanceof Error ? reason.message : "No se pudo aplicar el pago.", "error"); } finally { setBusy(false); }
  };

  if (!ownerId || !empresaId) return <StateMessage title="Empresa no disponible" detail="Tu sesión no tiene una empresa asociada." />;

  return <main className="mx-auto w-full max-w-[1500px] space-y-5 pb-8 text-[var(--foreground)]">
    <header className="relative overflow-hidden rounded-3xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 shadow-sm sm:p-7"><div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--primary)]/10 blur-3xl" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--primary)]">Control financiero</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Cuentas</h1><p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">Facturas, vencimientos y pagos de clientes y proveedores en un mismo lugar.</p></div>{tab === "cobrar" || tab === "pagar" ? <button className={primaryButton} onClick={() => setFormSide(tab === "cobrar" ? "cliente" : "proveedor")}><FilePlus2 className="h-4 w-4" />Nueva factura</button> : null}</div></header>
    <nav aria-label="Secciones de cuentas" className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-1.5">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`min-w-max flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === item.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"}`}>{item.label}</button>)}</nav>
    {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600"><span><strong>Error al cargar:</strong> {error}</span><button onClick={() => location.reload()} className="rounded-lg p-2 hover:bg-rose-500/10" aria-label="Reintentar"><RefreshCw className="h-4 w-4" /></button></div> : null}
    {loading ? <Loading /> : <>
      {tab === "resumen" ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total por cobrar" value={metrics.receivable} icon={TrendingUp} tone="sky" /><Metric title="Total por pagar" value={metrics.payable} icon={TrendingDown} tone="amber" /><Metric title="Vencido por cobrar" value={metrics.clientOverdue} icon={AlertTriangle} tone="rose" /><Metric title="Vence hoy / próximos" value={addCurrency(metrics.today, metrics.upcoming)} icon={CalendarClock} tone="violet" /></div><div className="grid gap-4 lg:grid-cols-2"><Snapshot title="Clientes" total={metrics.receivable} overdue={metrics.clientOverdue} count={clientInvoices.length} onOpen={() => setTab("cobrar")} /><Snapshot title="Proveedores" total={metrics.payable} overdue={metrics.supplierOverdue} count={supplierInvoices.length} onOpen={() => setTab("pagar")} /></div></> : null}
      {tab === "cobrar" ? <><div className="grid gap-3 sm:grid-cols-3"><Metric title="Por cobrar" value={metrics.receivable} icon={CircleDollarSign} tone="sky" /><Metric title="Vencido" value={metrics.clientOverdue} icon={AlertTriangle} tone="rose" /><Metric title="Pendiente hoy" value={metrics.today} icon={CalendarClock} tone="violet" /></div><InvoiceTable invoices={clientInvoices} side="cliente" onPay={setPaying} /></> : null}
      {tab === "pagar" ? <><div className="grid gap-3 sm:grid-cols-3"><Metric title="Por pagar" value={metrics.payable} icon={Scale} tone="amber" /><Metric title="Vencido" value={metrics.supplierOverdue} icon={AlertTriangle} tone="rose" /><Metric title="Próximos 7 días" value={metrics.upcoming} icon={CalendarClock} tone="violet" /></div><InvoiceTable invoices={supplierInvoices} side="proveedor" onPay={setPaying} /></> : null}
      {tab === "reportes" ? <AccountsReports invoices={invoices} payments={payments} /> : null}
    </>}
    {formSide ? <InvoiceForm side={formSide} busy={busy} onClose={() => setFormSide(null)} onSubmit={addInvoice} /> : null}
    {paying ? <PaymentModal invoice={paying} busy={busy} onClose={() => setPaying(null)} onSubmit={applyPayment} /> : null}
  </main>;
}

function invoiceDateKey(invoice: AccountingInvoice) { return dateKey(invoice.fechaVencimiento); }
function dayNumber(key: string) { const [year, month, day] = key.split("-").map(Number); return Date.UTC(year, month - 1, day) / 86_400_000; }
function daysUntil(invoice: AccountingInvoice) { return dayNumber(invoiceDateKey(invoice)) - dayNumber(todayKey()); }
function addCurrency(a: CurrencyTotals, b: CurrencyTotals): CurrencyTotals { return { CRC: a.CRC + b.CRC, USD: a.USD + b.USD }; }
function crDate(key: string) { return new Date(`${key}T12:00:00-06:00`); }
const tones = { sky: "bg-sky-500/10 text-sky-600", amber: "bg-amber-500/10 text-amber-600", rose: "bg-rose-500/10 text-rose-600", violet: "bg-violet-500/10 text-violet-600" };
function CurrencyValues({ value, compact = false }: { value: CurrencyTotals; compact?: boolean }) { return <div className={compact ? "mt-1" : "mt-2"}><p className={`${compact ? "text-sm" : "text-xl"} font-black tracking-tight`}>{money(value.CRC, "CRC")}</p><p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-[var(--muted-foreground)]`}>{money(value.USD, "USD")}</p></div>; }
function Metric({ title, value, icon: Icon, tone }: { title: string; value: CurrencyTotals; icon: typeof TrendingUp; tone: keyof typeof tones }) { return <article className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-[var(--muted-foreground)]">{title}</p><CurrencyValues value={value} /></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span></div></article>; }
function Snapshot({ title, total, overdue, count, onOpen }: { title: string; total: CurrencyTotals; overdue: CurrencyTotals; count: number; onOpen: () => void }) { return <button onClick={onOpen} className="group rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)]"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><span className="text-sm font-semibold text-[var(--primary)]">Ver detalle →</span></div><div className="mt-5 grid grid-cols-3 gap-3"><MiniCurrency label="Saldo" value={total} /><MiniCurrency label="Vencido" value={overdue} danger /><Mini label="Facturas" value={String(count)} /></div></button>; }
function MiniCurrency({ label, value, danger }: { label: string; value: CurrencyTotals; danger?: boolean }) { return <div className={danger && (value.CRC > 0 || value.USD > 0) ? "text-rose-500" : ""}><p className="text-xs text-[var(--muted-foreground)]">{label}</p><CurrencyValues value={value} compact /></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 truncate font-bold">{value}</p></div>; }
function Loading() { return <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((x) => <div key={x} className="h-28 animate-pulse rounded-2xl bg-[var(--hover-bg)]" />)}</div>; }
function StateMessage({ title, detail }: { title: string; detail: string }) { return <div className="mx-auto max-w-xl rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-8 text-center"><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">{detail}</p></div>; }
