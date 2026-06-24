import { MovementAccountKey } from "../movimientos-fondos";
import type { ClosingReconciliation } from "@/domain/reconciliation";

export type DailyClosingEmailContext = {
  company: string;
  accountKey: MovementAccountKey;
  closingDateISO: string;
  manager: string;
  totalCRC: number;
  totalUSD: number;
  recordedBalanceCRC: number;
  recordedBalanceUSD: number;
  diffCRC: number;
  diffUSD: number;
  notes?: string;
  singleClosingReason?: string;
  noMovements?: boolean;
  noMovementsReason?: string;
  reconciliation?: ClosingReconciliation;
};

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

const crcFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (currency: "CRC" | "USD", value: number) => {
  const formatter = currency === "USD" ? usdFormatter : crcFormatter;
  return formatter.format(Math.trunc(value));
};

const formatDiff = (currency: "CRC" | "USD", diff: number) => {
  if (diff === 0) return "Sin diferencias";
  const formatted = formatCurrency(currency, Math.abs(diff));
  return diff > 0 ? `Sobrante de ${formatted}` : `Faltante de ${formatted}`;
};

export const buildDailyClosingEmailTemplate = (
  context: DailyClosingEmailContext,
): EmailTemplate => {
  const closingDate = new Date(context.closingDateISO);
  const dateLabel = new Intl.DateTimeFormat("es-CR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(closingDate);

  const subject = `Nuevo cierre diario - ${context.company}`;

  const notesSection =
    context.notes && context.notes.trim().length > 0
      ? `
Notas:
${context.notes.trim()}
`
      : "";

  const singleClosingReasonSection =
    context.singleClosingReason && context.singleClosingReason.trim().length > 0
      ? `
Motivo cierre unico:
${context.singleClosingReason.trim()}
`
      : "";

  const noMovementsSection =
    context.noMovements && context.noMovementsReason?.trim().length
      ? `
Sin movimientos:
${context.noMovementsReason.trim()}
`
      : "";
  const reconciliationSection = context.reconciliation
    ? `\nVerificación Contica / Tucán / Tiempos:\n Contica | Sistema | Diferencia\n R08: ${context.reconciliation.contica.r08} | Tucán: ${context.reconciliation.calculated.tucanForShift} | ${context.reconciliation.calculated.tucanDifference}\n T11: ${context.reconciliation.contica.t11} | Tiempos: ${context.reconciliation.calculated.tiemposForShift} | ${context.reconciliation.calculated.previousTiemposPending > 0 ? context.reconciliation.calculated.tiemposRealShiftDifference : context.reconciliation.calculated.tiemposRawDifference}\n Tucán acumulado digitado: ${context.reconciliation.externalSnapshots.tucanCumulative}\n Tiempos acumulado digitado: ${context.reconciliation.externalSnapshots.tiemposCumulative}\n ${context.reconciliation.calculated.previousTiemposPending > 0 ? context.reconciliation.calculated.compensatedTiemposAmount > 0 ? `Resolución turno anterior: se compensaron ${context.reconciliation.calculated.compensatedTiemposAmount}.` : "Resolución turno anterior: no hubo compensación." : "Resolución turno anterior: no aplica; se espera cierre nocturno."}\n`
    : "";
  const reconciliationExplanation =
    context.reconciliation?.tiemposStatus === "TEMPORARY_PENDING"
      ? "Diferencia temporal: se espera revision del cierre nocturno."
      : context.reconciliation?.tiemposStatus === "RESOLVED"
        ? `Se compensaron ${context.reconciliation.calculated.compensatedTiemposAmount} pendientes del turno diurno; no existe diferencia real nocturna para TIEMPOS.`
        : "";
  const tiemposDifferenceForDisplay = context.reconciliation
    ? context.reconciliation.calculated.previousTiemposPending > 0
      ? context.reconciliation.calculated.tiemposRealShiftDifference
      : context.reconciliation.calculated.tiemposRawDifference
    : 0;
  const reconciliationResolution = context.reconciliation
    ? context.reconciliation.calculated.previousTiemposPending > 0
      ? context.reconciliation.calculated.compensatedTiemposAmount > 0
        ? `Resolucion turno anterior: se compensaron ${context.reconciliation.calculated.compensatedTiemposAmount}.`
        : "Resolucion turno anterior: no hubo compensacion."
      : "Resolucion turno anterior: no aplica; se espera cierre nocturno."
    : "";
  const tiemposSystemDisplay = context.reconciliation
    ? context.reconciliation.calculated.compensatedTiemposAmount > 0
      ? `Tiempos: ${context.reconciliation.calculated.tiemposForShift} - ${context.reconciliation.calculated.compensatedTiemposAmount} = ${context.reconciliation.contica.t11}`
      : `Tiempos: ${context.reconciliation.calculated.tiemposForShift}`
    : "";

  const text = `Se registro un nuevo cierre diario en Time Master.

Empresa: ${context.company}
Cuenta: ${context.accountKey}
Fecha: ${dateLabel}
Encargado: ${context.manager}

Totales declarados:
 - Colones: ${formatCurrency("CRC", context.totalCRC)}
 - Dolares: ${formatCurrency("USD", context.totalUSD)}

Saldos registrados en sistema:
 - Colones: ${formatCurrency("CRC", context.recordedBalanceCRC)}
 - Dolares: ${formatCurrency("USD", context.recordedBalanceUSD)}

Diferencias:
 - Colones: ${formatDiff("CRC", context.diffCRC)}
 - Dolares: ${formatDiff("USD", context.diffUSD)}
${singleClosingReasonSection}${noMovementsSection}${reconciliationSection}${reconciliationExplanation}${notesSection}`.trim();

  const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1b1f23;">
            <h2 style="margin-bottom: 12px;">Nuevo cierre diario registrado</h2>
            <p style="margin: 0 0 12px 0;">Se registro un cierre para <strong>${context.company}</strong> en la cuenta <strong>Fondo General</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tbody>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #d0d7de; font-weight: 600;">Fecha</td>
                        <td style="padding: 8px; border: 1px solid #d0d7de;">${dateLabel}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #d0d7de; font-weight: 600;">Encargado</td>
                        <td style="padding: 8px; border: 1px solid #d0d7de;">${context.manager}</td>
                    </tr>
                </tbody>
            </table>
            <h3 style="margin: 16px 0 8px 0;">Totales declarados</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: <strong>${formatCurrency("CRC", context.totalCRC)}</strong></li>
                <li>Dolares: <strong>${formatCurrency("USD", context.totalUSD)}</strong></li>
            </ul>
            <h3 style="margin: 16px 0 8px 0;">Saldos registrados</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: ${formatCurrency("CRC", context.recordedBalanceCRC)}</li>
                <li>Dolares: ${formatCurrency("USD", context.recordedBalanceUSD)}</li>
            </ul>
            <h3 style="margin: 16px 0 8px 0;">Diferencias</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: ${formatDiff("CRC", context.diffCRC)}</li>
                <li>Dolares: ${formatDiff("USD", context.diffUSD)}</li>
            </ul>
            ${
              context.reconciliation
                ? `<h3 style="margin: 16px 0 8px 0;">Conciliacion Contica / Tucan / Tiempos</h3><table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;"><thead><tr><th style="padding: 8px; border: 1px solid #d0d7de; text-align: left;">Contica</th><th style="padding: 8px; border: 1px solid #d0d7de; text-align: left;">Sistema</th><th style="padding: 8px; border: 1px solid #d0d7de; text-align: left;">Diferencia</th></tr></thead><tbody><tr><td style="padding: 8px; border: 1px solid #d0d7de;">R08: ${context.reconciliation.contica.r08}</td><td style="padding: 8px; border: 1px solid #d0d7de;">Tucan: ${context.reconciliation.calculated.tucanForShift}</td><td style="padding: 8px; border: 1px solid #d0d7de;">${context.reconciliation.calculated.tucanDifference}</td></tr><tr><td style="padding: 8px; border: 1px solid #d0d7de;">T11: ${context.reconciliation.contica.t11}</td><td style="padding: 8px; border: 1px solid #d0d7de;">${tiemposSystemDisplay}</td><td style="padding: 8px; border: 1px solid #d0d7de;">${tiemposDifferenceForDisplay}</td></tr></tbody></table><p style="margin: 0 0 8px 0;"><strong>Tucan acumulado digitado:</strong> ${context.reconciliation.externalSnapshots.tucanCumulative}<br/><strong>Tiempos acumulado digitado:</strong> ${context.reconciliation.externalSnapshots.tiemposCumulative}<br/>${reconciliationResolution}</p><p style="margin: 0 0 16px 0;">${reconciliationExplanation}</p>`
                : ""
            }
            ${
              context.singleClosingReason && context.singleClosingReason.trim().length > 0
                ? `<div style="border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                        <strong>Motivo cierre unico:</strong>
                        <p style="margin: 8px 0 0 0; white-space: pre-line;">${context.singleClosingReason.trim()}</p>
                    </div>`
                : ""
            }
            ${
              context.noMovements && context.noMovementsReason?.trim().length
                ? `<div style="border-left: 4px solid #f97316; background: #fff7ed; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                        <strong>Sin movimientos:</strong>
                        <p style="margin: 8px 0 0 0; white-space: pre-line;">${context.noMovementsReason.trim()}</p>
                    </div>`
                : ""
            }
            ${
              context.notes && context.notes.trim().length > 0
                ? `<div style="border-left: 4px solid #0366d6; background: #f1f8ff; padding: 12px 16px; border-radius: 6px;">
                        <strong>Notas:</strong>
                        <p style="margin: 8px 0 0 0; white-space: pre-line;">${context.notes.trim()}</p>
                    </div>`
                : ""
            }
        </div>
    `;

  return {
    subject,
    text,
    html,
  };
};
