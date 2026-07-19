import type { DailyClosingRecord } from "@/services/daily-closings";

const money = (currency: "CRC" | "USD", amount: number) =>
  new Intl.NumberFormat(currency === "CRC" ? "es-CR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(Math.round((Number(amount) || 0) * 100) / 100) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.round((Number(amount) || 0) * 100) / 100);

const diff = (currency: "CRC" | "USD", amount: number) =>
  amount === 0 ? "Sin diferencias" : `${amount > 0 ? "Sobrante" : "Faltante"} de ${money(currency, Math.abs(amount))}`;

const row = (ctx: CanvasRenderingContext2D, y: number, cells: string[], bold = false) => {
  const x = [50, 430, 810];
  ctx.font = `${bold ? "600" : "400"} ${cells.some((cell) => cell.length > 26) ? "17" : "25"}px Arial`;
  cells.forEach((cell, index) => {
    ctx.strokeStyle = "#d0d7de";
    ctx.strokeRect(x[index], y, 360, 48);
    ctx.fillStyle = "#1b1f23";
    ctx.fillText(cell, x[index] + 12, y + 32, 335);
  });
};

/** Standalone SuperAdmin export. Browser-only. */
export async function exportDailyClosingSuperAdminImage(
  company: string,
  record: DailyClosingRecord,
): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = record.reconciliation ? 1050 : 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo generar imagen del cierre.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1b1f23";
  ctx.font = "600 38px Arial";
  ctx.fillText("Nuevo cierre diario registrado", 50, 62);
  ctx.font = "24px Arial";
  ctx.fillText(`Empresa: ${company} · Fondo General`, 50, 105);
  ctx.fillText(`Fecha: ${new Intl.DateTimeFormat("es-CR", { dateStyle: "full", timeStyle: "short" }).format(new Date(record.closingDate))}`, 50, 140);
  ctx.fillText(`Encargado: ${record.manager}`, 50, 175);
  ctx.font = "600 28px Arial";
  ctx.fillText("Resumen de cierre", 50, 225);
  row(ctx, 245, ["Concepto", "Colones", "Dolares"], true);
  row(ctx, 293, ["Totales declarados", money("CRC", record.totalCRC), money("USD", record.totalUSD)]);
  row(ctx, 341, ["Saldos registrados", money("CRC", record.recordedBalanceCRC), money("USD", record.recordedBalanceUSD)]);
  row(ctx, 389, ["Diferencias", diff("CRC", record.diffCRC), diff("USD", record.diffUSD)]);
  if (record.reconciliation) {
    const r = record.reconciliation;
    ctx.font = "600 28px Arial";
    ctx.fillText("Conciliacion Contica / Tucan / Tiempos", 50, 510);
    row(ctx, 530, ["Contica", "Sistema", "Diferencia"], true);
    row(ctx, 578, [
      `R08: ${money("CRC", r.contica.r08)}`,
      `Tucan: ${money("CRC", r.calculated.tucanForShift)}`,
      money("CRC", r.calculated.tucanDifference),
    ]);
    const compensated = r.calculated.compensatedTiemposAmount;
    const tiemposSystem = compensated > 0
      ? `Tiempos: ${money("CRC", r.calculated.tiemposForShift)} - ${money("CRC", compensated)} = ${money("CRC", r.contica.t11)}`
      : `Tiempos: ${money("CRC", r.calculated.tiemposForShift)}`;
    const tiemposDifference = r.calculated.previousTiemposPending > 0
      ? r.calculated.tiemposRealShiftDifference
      : r.calculated.tiemposRawDifference;
    row(ctx, 626, [`T11: ${money("CRC", r.contica.t11)}`, tiemposSystem, money("CRC", tiemposDifference)]);
    ctx.font = "24px Arial";
    ctx.fillText(`Tucan acumulado digitado: ${money("CRC", r.externalSnapshots.tucanCumulative)} · Tiempos acumulado digitado: ${money("CRC", r.externalSnapshots.tiemposCumulative)}`, 50, 715, 1100);
    const resolution = r.calculated.previousTiemposPending > 0
      ? compensated > 0
        ? `Resolucion turno anterior: se compensaron ${money("CRC", compensated)}.`
        : "Resolucion turno anterior: no hubo compensacion."
      : "Resolucion turno anterior: no aplica; se espera cierre nocturno.";
    ctx.fillText(resolution, 50, 755, 1100);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo codificar imagen del cierre.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cierre-${company}-${record.closingDate.slice(0, 10)}-${record.turno ?? "D"}.png`;
  link.click();
  URL.revokeObjectURL(url);
}
