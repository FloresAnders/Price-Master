import type { BillsMap, CashCounterData } from "./types";
import { DENOM_ACCENTS, CRC_DENOMS, USD_DENOMS } from "./constants";

export function badgeColor(value: number): string {
  return DENOM_ACCENTS[value] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/25";
}

export function badgeLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  return String(value);
}

export function denomsByCurrency(cur: "CRC" | "USD") {
  return cur === "CRC" ? CRC_DENOMS : USD_DENOMS;
}

export function calcBDBreakdown(bills: BillsMap, cur: "CRC" | "USD") {
  if (cur === "CRC") {
    const b20 = (bills[20000] || 0) * 20000 + (bills[10000] || 0) * 10000;
    const b25 = b20 + (bills[5000] || 0) * 5000;
    const b2 = (bills[2000] || 0) * 2000 + (bills[1000] || 0) * 1000;
    const mon = (bills[500] || 0) * 500 + (bills[100] || 0) * 100 + (bills[50] || 0) * 50 + (bills[25] || 0) * 25;
    return [{ l: "₡20k + ₡10k", v: b20 }, { l: "₡+ ₡5k", v: b25 }, { l: "₡2k + ₡1k", v: b2 }, { l: "Monedas", v: mon }];
  }
  const b20 = (bills[20] || 0) * 20 + (bills[10] || 0) * 10;
  return [{ l: "$20+$10", v: b20 }, { l: "$+$5", v: b20 + (bills[5] || 0) * 5 }, { l: "$1", v: (bills[1] || 0) * 1 }];
}

export function fmtCurrency(n: number, cur: "CRC" | "USD"): string {
  return new Intl.NumberFormat(cur === "CRC" ? "es-CR" : "en-US", {
    style: "currency", currency: cur, minimumFractionDigits: 0,
  }).format(n);
}

export function calcTotal(bills: BillsMap, extra: number): number {
  return Object.entries(bills).reduce((a, [d, c]) => a + Number(d) * Number(c), 0) + extra;
}

export function parseBillCountInput(input: string): number {
  const value = input.trim().replace(/^=/, "").replace(/\s+/g, "");
  const formula = value.match(/^(\d+(?:\.\d+)?)([+-])(\d+(?:\.\d+)?)$/);

  if (formula) {
    const left = Number(formula[1]);
    const right = Number(formula[3]);
    const result = formula[2] === "+" ? left + right : left - right;
    return Math.max(0, Math.trunc(result));
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function getBillCountKeyAction(event: {
  key: string;
  code: string;
  shiftKey: boolean;
}): "increment" | "decrement" | "type" | "none" {
  if ((event.key === "+" || event.key === "-") && event.shiftKey) return "type";
  if (event.key === "+" || event.code === "NumpadAdd") return "increment";
  if (event.key === "-" || event.code === "NumpadSubtract") return "decrement";
  return "none";
}

export function calcCashDifference(total: number, aperturaCaja: number, ventaActual: number): {
  type: "sobrante" | "faltante" | "equilibrio";
  amount: number;
} {
  const expected = aperturaCaja + ventaActual;
  const diff = total - expected;
  if (diff > 0) return { type: "sobrante", amount: diff };
  if (diff < 0) return { type: "faltante", amount: Math.abs(diff) };
  return { type: "equilibrio", amount: 0 };
}

export function buildCashCounterExportSummary(data: CashCounterData) {
  const total = calcTotal(data.bills, data.extraAmount);
  const denoms = denomsByCurrency(data.currency).map((denom) => {
    const count = data.bills[denom.value] || 0;
    return {
      label: denom.label,
      value: denom.value,
      count,
      subtotal: denom.value * count,
    };
  });

  return {
    name: data.name,
    currency: data.currency,
    total,
    billsTotal: total - data.extraAmount,
    totalBillsCount: denoms.reduce((sum, denom) => sum + denom.count, 0),
    activeDenoms: denoms.filter((denom) => denom.count > 0).length,
    extraAmount: data.extraAmount,
    aperturaCaja: data.aperturaCaja,
    ventaActual: data.ventaActual,
    expectedTotal: data.aperturaCaja + data.ventaActual,
    difference: calcCashDifference(total, data.aperturaCaja, data.ventaActual),
    denoms,
  };
}
