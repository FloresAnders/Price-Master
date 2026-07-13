import type { buildCashCounterExportSummary } from "@/components/business/cash-counter-tabs/utils";

type CashCounterExportSummary = ReturnType<typeof buildCashCounterExportSummary>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function badgeClass(index: number): string {
  return ["orange", "green", "yellow", "blue", "red", "gold", "gray", "bronze"][index] || "gray";
}

function badgeLabel(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  return String(value);
}

function formatMoney(value: number, currency: "CRC" | "USD"): string {
  return new Intl.NumberFormat(currency === "CRC" ? "es-CR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value);
}

export function buildCashCounterPreviewHtml(summary: CashCounterExportSummary, reportDate: string): string {
  const rows = summary.denoms.map((denom, index) => {
    const pct = summary.total > 0 ? (denom.subtotal / summary.total) * 100 : 0;
    return `
<div class="card">
<div class="row">
<div class="left">
<div class="badge ${badgeClass(index)}">${escapeHtml(badgeLabel(denom.value))}</div>
<div class="money">${escapeHtml(formatMoney(denom.value, summary.currency))}</div>
</div>
<div class="qty">${denom.count}</div>
<div class="right">
<div class="sub">${escapeHtml(formatMoney(denom.subtotal, summary.currency))} <span class="percent">${pct.toFixed(1)}%</span></div>
<div class="progress"><div class="bar" style="width:${Math.min(pct, 100).toFixed(1)}%"></div></div>
</div>
</div>
</div>`;
  }).join("");

  const diffText = summary.difference.type === "sobrante"
    ? `Sobrante: ${formatMoney(summary.difference.amount, summary.currency)}`
    : summary.difference.type === "faltante"
      ? `Faltante: ${formatMoney(summary.difference.amount, summary.currency)}`
      : "Sin diferencia";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Conteo de Efectivo</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:Segoe UI,Arial,sans-serif;}
body{background:#0c1220;color:#fff;padding:18px;}
.container{width:1050px;margin:auto;background:#0c1220;color:#fff;padding:18px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
.header h1{font-size:24px;}
.header p{color:#9ca3af;font-size:12px;margin-top:4px;}
.table-header{display:grid;grid-template-columns:2fr 1fr 1fr;color:#7fcfff;font-size:10px;text-transform:uppercase;margin-bottom:8px;letter-spacing:1px;}
.card{background:#111827;border:1px solid #263043;border-radius:12px;padding:10px 14px;margin-bottom:8px;}
.row{display:grid;grid-template-columns:2fr 1fr 1fr;align-items:center;}
.left{display:flex;align-items:center;gap:15px;}
.badge{width:54px;height:34px;border-radius:8px;display:flex;justify-content:center;align-items:center;font-weight:bold;color:white;}
.orange{background:#6b3b16;}.green{background:#004d40;}.yellow{background:#6d5200;}.blue{background:#173a72;}.red{background:#5d2030;}.gold{background:#6d4c00;}.gray{background:#27364d;}.bronze{background:#5d4517;}
.money{font-size:16px;}.qty{text-align:center;font-size:22px;font-weight:bold;}.right{text-align:right;}.sub{font-size:22px;font-weight:bold;}.percent{color:#9ca3af;font-size:12px;}
.progress{margin-top:5px;height:6px;background:#2c3445;border-radius:20px;overflow:hidden;}.bar{height:100%;background:#6be0d2;}
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 12px;}
.summary-card{background:#0f172a;border:1px solid #263043;border-radius:10px;padding:9px;text-align:center;}
.summary-card span{display:block;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;}
.summary-card strong{font-size:15px;}
.total{margin-top:14px;background:#0f172a;border:2px solid #2dd4bf;border-radius:14px;text-align:center;padding:16px;}
.total h2{color:#9ca3af;margin-bottom:6px;font-size:14px;}.total h1{font-size:34px;color:#fff;}
</style>
</head>
<body>
<div class="container">
<div class="header">
<div><h1>REPORTE DE CONTEO</h1><p>${escapeHtml(summary.name)}</p></div>
<div>${escapeHtml(reportDate)}</div>
</div>
<div class="summary">
<div class="summary-card"><span>Apertura</span><strong>${escapeHtml(formatMoney(summary.aperturaCaja, summary.currency))}</strong></div>
<div class="summary-card"><span>Venta</span><strong>${escapeHtml(formatMoney(summary.ventaActual, summary.currency))}</strong></div>
<div class="summary-card"><span>Esperado</span><strong>${escapeHtml(formatMoney(summary.expectedTotal, summary.currency))}</strong></div>
<div class="summary-card"><span>Estado</span><strong>${escapeHtml(diffText)}</strong></div>
</div>
<div class="table-header">
<div>Denominación</div>
<div style="text-align:center;">Cantidad</div>
<div style="text-align:right;">Subtotal</div>
</div>
${rows}
<div class="total">
<h2>TOTAL GENERAL</h2>
<h1>${escapeHtml(formatMoney(summary.total, summary.currency))}</h1>
</div>
</div>
</body>
</html>`;
}
