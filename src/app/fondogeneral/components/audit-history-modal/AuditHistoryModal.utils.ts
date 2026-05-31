import type { Snapshot, FinResult } from "./AuditHistoryModal.types";

// ── Constants ──────────────────────────────────────────

export const PO = [
  "providerCode", "provider", "providerName", "paymentType", "type", "movementType",
  "amountIngreso", "amountEgreso", "ingreso", "egreso", "amount", "monto", "currency",
  "invoiceNumber", "notes", "manager",
] as const;

export const fieldLabels: Record<string, string> = {
  providerCode: "Código proveedor", provider: "Proveedor", providerName: "Nombre proveedor",
  paymentType: "Tipo de pago", type: "Tipo", movementType: "Tipo de movimiento",
  amountIngreso: "Monto ingreso", amountEgreso: "Monto egreso", ingreso: "Ingreso", egreso: "Egreso",
  amount: "Monto", monto: "Monto", currency: "Moneda", invoiceNumber: "N° factura",
  invoiceDocType: "Tipo documento", invoiceCreatedAt: "Fecha factura",
  originalAmount: "Monto original", amountDue: "Monto pendiente", balanceDue: "Saldo pendiente",
  paidAmount: "Monto pagado", paymentStatus: "Estado de pago", amountPayment: "Monto abonado",
  appliedCreditNotes: "Notas de crédito", manager: "Encargado", manager2: "Encargado (2)",
  notes: "Notas", accountId: "Cuenta", empresa: "Empresa", company: "Empresa",
  closingDate: "Fecha de cierre", totalCRC: "Total CRC", totalUSD: "Total USD",
  recordedBalanceCRC: "Saldo registrado CRC", recordedBalanceUSD: "Saldo registrado USD",
  diffCRC: "Diferencia CRC", diffUSD: "Diferencia USD",
  breakdownCRC: "Desglose CRC", breakdownUSD: "Desglose USD", breakdown: "Desglose",
  closingBalanceCRC: "Saldo cierre CRC", closingBalanceUSD: "Saldo cierre USD",
  classification: "Clasificación", adjustmentResolution: "Resolución de ajuste",
  id: "ID", movementId: "ID movimiento", originalEntryId: "ID entrada original",
  isAudit: "Es auditoría", createdAt: "Creado", updateAt: "Actualizado", at: "Fecha",
  category: "Categoría", name: "Nombre", order: "Orden", status: "Estado",
  consecutive: "Consecutivo", invoiceFolio: "Folio factura", isAdjustment: "Ajuste",
  providerInvoiceData: "Datos factura prov.", exchangeRate: "Tipo de cambio", closing_id: "Cierre ID",
};

export const LEGEND = [
  { color: "bg-green-500", label: "Ingreso" },
  { color: "bg-yellow-400", label: "Modificado" },
  { color: "bg-red-500", label: "Egreso" },
] as const;

// ── Pure Utilities ─────────────────────────────────────

export function snap(s: unknown): Snapshot {
  return (typeof s === "object" && s !== null && !Array.isArray(s) ? s : {}) as Snapshot;
}

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const p = Number(t.replaceAll(",", ""));
  return Number.isFinite(p) ? p : null;
}

export function isIn(k: string): boolean {
  return k.toLowerCase().includes("ingreso") || k.toLowerCase() === "amountingreso";
}

export function isEg(k: string): boolean {
  return k.toLowerCase().includes("egreso") || k.toLowerCase() === "amountegreso";
}

export function cur(b: Snapshot, a: Snapshot): "CRC" | "USD" {
  return ((a?.currency ?? b?.currency) as string) === "USD" ? "USD" : "CRC";
}

export function sv(v: unknown): string {
  if (v === undefined) return "undefined";
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function diffKeys(b: Snapshot, a: Snapshot): string[] {
  const all = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changed = [...all].filter((k) => sv(b[k]) !== sv(a[k]));
  const ord = [...PO.filter((k) => all.has(k as string))] as string[];
  const rest = changed.filter((k) => !ord.includes(k)).sort((x, y) => x.localeCompare(y));
  const inc = ["amountIngreso", "amountEgreso", "ingreso", "egreso"].filter((k) => all.has(k));
  const base = [...new Set([...ord, ...inc])].filter((k) => changed.includes(k) || inc.includes(k));
  return [...new Set([...base, ...rest])];
}

export function pick(s: Snapshot, ks: string[]): unknown {
  for (const k of ks) {
    const v = s?.[k];
    if (v !== undefined && v !== null && String(v).trim()) return v;
  }
}

export function cls(k: string, bv: unknown, av: unknown): string {
  const bn = num(bv), an = num(av);
  if (sv(bv) === sv(av)) return "text-[var(--foreground)]";
  if ((isIn(k) || k === "amountIngreso") && bn !== null && an !== null)
    return an < bn ? "text-red-400 font-semibold" : "text-green-400 font-semibold";
  if ((isEg(k) || k === "amountEgreso") && bn !== null && an !== null)
    return an > bn ? "text-red-400 font-semibold" : "text-green-400 font-semibold";
  return "text-yellow-300 font-semibold";
}

export function fin(
  b: Snapshot, a: Snapshot, c: "CRC" | "USD",
  fmt: (curr: "CRC" | "USD", value: number) => string,
): FinResult {
  const bi = num(b?.amountIngreso ?? b?.ingreso) ?? 0;
  const ai = num(a?.amountIngreso ?? a?.ingreso) ?? 0;
  const be = num(b?.amountEgreso ?? b?.egreso) ?? 0;
  const ae = num(a?.amountEgreso ?? a?.egreso) ?? 0;
  const di = ai - bi, de = ae - be;
  const arr = (f: number, t: number) => t > f ? "↑" : t < f ? "↓" : "→";
  const il = `Ingreso: ${fmt(c, bi)} → ${fmt(c, ai)} ${arr(bi, ai)}`;
  const el = `Egreso: ${fmt(c, be)} → ${fmt(c, ae)} ${arr(be, ae)}`;
  const approx = (x: number, y: number) => Math.abs(x - y) <= 0.0001;
  let hl: string | null = null;
  if (bi > 0 && ai <= 0 && be <= 0 && ae > 0)
    hl = `Cambio financiero detectado: Ingreso → Egreso (${fmt(c, approx(bi, ae) ? ae : Math.max(bi, ae))})`;
  else if (be > 0 && ae <= 0 && bi <= 0 && ai > 0)
    hl = `Cambio financiero detectado: Egreso → Ingreso (${fmt(c, approx(be, ai) ? ai : Math.max(be, ai))})`;
  else if (di !== 0 || de !== 0) hl = "Cambio financiero detectado";
  return { hl, il, el, bi, ai, be, ae, di, de };
}

export function fmtField(
  k: string, v: unknown, c: "CRC" | "USD",
  providersMap: Map<string, string>,
  formatByCurrency: (currency: "CRC" | "USD", value: number) => string,
): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (k === "providerCode") {
    const code = String(v).trim();
    const r = providersMap.get(code);
    return r ? `${code} — ${r}` : code || "—";
  }
  if (typeof v === "string") return v.trim() || "—";
  const n = num(v);
  if (n !== null) {
    if (isIn(k) || isEg(k) || k === "amount" || k === "monto") return formatByCurrency(c, n);
    return String(n);
  }
  if (Array.isArray(v)) return v.length ? "[lista]" : "[]";
  return typeof v === "object" && v !== null ? "[objeto]" : String(v);
}
