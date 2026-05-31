"use client";

import { memo, useMemo, useCallback } from "react";
import {
  ArrowUpFromLine, ArrowDownToLine,
  FileText, GitCompareArrows, Clock, ChevronDown,
} from "lucide-react";
import type { AuditHistoryItemProps, Snapshot, FinResult } from "./AuditHistoryModal.types";
import {
  snap, cur, sv, diffKeys, pick, cls, fin, fmtField, fieldLabels, isIn, isEg,
} from "./AuditHistoryModal.utils";

// ── Field Row ──────────────────────────────────────────

interface FRProps { l: string; v: string; c: string }

const FR = memo(function FR({ l, v, c }: FRProps) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-[var(--muted-foreground)]">{l}</span>
      <span className={c}>{v}</span>
    </div>
  );
});

// ── Summary Card ───────────────────────────────────────

interface SCProps {
  t: string; pv: string; tv: string; iv: string; ev: string;
  pc: boolean; tc: boolean; ic: string; ec: string;
}

const SC = memo(function SC({ t, pv, tv, iv, ev, pc, tc, ic, ec }: SCProps) {
  return (
    <div className="rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        <FileText className="h-3 w-3" strokeWidth={1.5} />{t}
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <FR l="Proveedor" v={pv} c={pc ? "text-yellow-300 font-semibold" : "text-[var(--foreground)]"} />
        <FR l="Tipo" v={tv} c={tc ? "text-yellow-300 font-semibold" : "text-[var(--foreground)]"} />
        <FR l="Ingreso" v={iv} c={ic} />
        <FR l="Egreso" v={ev} c={ec} />
      </div>
    </div>
  );
});

// ── Financial Indicator ────────────────────────────────

interface FinIndicatorProps { im: FinResult }

const FinancialIndicator = memo(function FinancialIndicator({ im }: FinIndicatorProps) {
  if (im.di === 0 && im.de === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <GitCompareArrows className="h-3.5 w-3.5 text-[var(--muted-foreground)]" strokeWidth={1.5} />
        Indicadores de cambio
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0 text-green-400" strokeWidth={1.5} />
          <span className={im.di < 0 ? "text-red-400" : im.di > 0 ? "text-green-400" : "text-[var(--muted-foreground)]"}>{im.il}</span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={1.5} />
          <span className={im.de > 0 ? "text-red-400" : im.de < 0 ? "text-green-400" : "text-[var(--muted-foreground)]"}>{im.el}</span>
        </div>
      </div>
    </div>
  );
});

// ── Diff Table ─────────────────────────────────────────

interface DiffTableProps {
  dk: string[];
  b: Snapshot;
  a: Snapshot;
  c: "CRC" | "USD";
  fmt: (k: string, v: unknown, c: "CRC" | "USD") => string;
}

const DiffTable = memo(function DiffTable({ dk, b, a, c, fmt }: DiffTableProps) {
  return (
    <div className="mt-3 overflow-auto rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/10 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <GitCompareArrows className="h-3.5 w-3.5 text-[var(--muted-foreground)]" strokeWidth={1.5} />
        Cambios (vista tipo diff)
      </div>
      <table className="mt-2 w-full min-w-[520px] text-xs sm:text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            <th className="py-2 pr-3 text-left">Campo</th>
            <th className="py-2 pr-3 text-left">Antes</th>
            <th className="py-2 text-left">Después</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--input-border)]">
          {dk.length === 0 ? (
            <tr><td colSpan={3} className="py-3 text-[var(--muted-foreground)]">No se detectaron diferencias.</td></tr>
          ) : dk.map((k) => {
            const bv = b[k], av = a[k], ch = sv(bv) !== sv(av);
            const beforeCls = ch && (isIn(k) || k === "amountIngreso") ? "text-green-400"
              : ch && (isEg(k) || k === "amountEgreso") ? "text-red-400"
              : "text-[var(--foreground)]";
            return (
              <tr key={k}>
                <td className="whitespace-nowrap py-2 pr-3 align-top text-[var(--muted-foreground)]">{fieldLabels[k] ?? k}</td>
                <td className="py-2 pr-3 align-top"><span className={beforeCls}>{fmt(k, bv, c)}</span></td>
                <td className="py-2 align-top"><span className={cls(k, bv, av)}>{fmt(k, av, c)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// ── Audit History Item ─────────────────────────────────

export const AuditHistoryItem = memo(function AuditHistoryItem({
  entry, idx, total, isLast, dateTimeFormatter, formatByCurrency, providersMap,
}: AuditHistoryItemProps) {
  const b = useMemo(() => snap(entry?.before), [entry?.before]);
  const a = useMemo(() => snap(entry?.after), [entry?.after]);
  const currency = useMemo(() => cur(b, a), [b, a]);

  const fmt = useCallback(
    (k: string, v: unknown, c: "CRC" | "USD") => fmtField(k, v, c, providersMap, formatByCurrency),
    [providersMap, formatByCurrency],
  );

  const dk = useMemo(() => diffKeys(b, a), [b, a]);
  const im = useMemo(() => fin(b, a, currency, formatByCurrency), [b, a, currency, formatByCurrency]);

  const pb = useMemo(() => pick(b, ["providerCode", "provider", "providerName"]), [b]);
  const pa = useMemo(() => pick(a, ["providerCode", "provider", "providerName"]), [a]);
  const tb = useMemo(() => pick(b, ["paymentType", "type", "movementType"]), [b]);
  const ta = useMemo(() => pick(a, ["paymentType", "type", "movementType"]), [a]);

  const pc = sv(pb) !== sv(pa);
  const tc = sv(tb) !== sv(ta);

  const entryNumber = idx + 1;
  const agoText = `${total - idx} cambio${total - idx !== 1 ? "s" : ""} atrás`;
  const formattedDate = entry?.at ? dateTimeFormatter.format(new Date(entry.at)) : "—";

  return (
    <details className="group rounded-xl border border-[var(--input-border)] bg-[var(--muted)]/5 transition-colors open:border-[var(--accent)]/30" open={isLast}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] text-[11px] font-semibold text-[var(--muted-foreground)] group-open:border-cyan-700/35 group-open:bg-cyan-950/25 group-open:text-cyan-300">
            {entryNumber}
          </span>
          <div className="min-w-0">
            <div className="text-xs text-[var(--muted-foreground)]">{formattedDate}</div>
            <div className="mt-px text-xs text-[var(--foreground)]/50">{agoText}</div>
          </div>
        </div>
        {im.hl && (
          <div className="hidden shrink-0 items-center gap-1.5 rounded-md border border-[var(--input-border)] bg-[var(--muted)]/10 px-2.5 py-1 sm:flex">
            <Clock className="h-3 w-3 text-[var(--muted-foreground)]" strokeWidth={1.5} />
            <span className="truncate text-[11px] font-medium text-[var(--muted-foreground)]">{im.hl}</span>
          </div>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-open:-rotate-180" strokeWidth={2} />
      </summary>

      <div className="border-t border-[var(--input-border)] px-4 pb-4">
        <FinancialIndicator im={im} />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SC
            t="Antes" pv={fmt("providerCode", pb, currency)} tv={fmt("paymentType", tb, currency)}
            iv={formatByCurrency(currency, im.bi)} ev={formatByCurrency(currency, im.be)}
            pc={pc} tc={tc}
            ic={cls("amountIngreso", b?.amountIngreso ?? b?.ingreso, a?.amountIngreso ?? a?.ingreso)}
            ec={cls("amountEgreso", b?.amountEgreso ?? b?.egreso, a?.amountEgreso ?? a?.egreso)}
          />
          <SC
            t="Después" pv={fmt("providerCode", pa, currency)} tv={fmt("paymentType", ta, currency)}
            iv={formatByCurrency(currency, im.ai)} ev={formatByCurrency(currency, im.ae)}
            pc={pc} tc={tc}
            ic={cls("amountIngreso", b?.amountIngreso ?? b?.ingreso, a?.amountIngreso ?? a?.ingreso)}
            ec={cls("amountEgreso", b?.amountEgreso ?? b?.egreso, a?.amountEgreso ?? a?.egreso)}
          />
        </div>

        <DiffTable dk={dk} b={b} a={a} c={currency} fmt={fmt} />
      </div>
    </details>
  );
});
