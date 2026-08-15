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

const formatCurrency = (currency: "CRC" | "USD", value: number) => {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  const formatter =
    currency === "USD"
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
          maximumFractionDigits: 2,
        })
      : new Intl.NumberFormat("es-CR", {
          style: "currency",
          currency: "CRC",
          minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
          maximumFractionDigits: 2,
        });
  return formatter.format(rounded);
};

const formatDiff = (currency: "CRC" | "USD", diff: number) => {
  if (diff === 0) return "Sin diferencias";
  const formatted = formatCurrency(currency, Math.abs(diff));
  return diff > 0 ? `Sobrante de ${formatted}` : `Faltante de ${formatted}`;
};

const formatCRC = (value: number) => formatCurrency("CRC", value);

const explainSystemDifference = (system: "Tucán" | "Tiempos", difference: number) => {
  if (difference === 0) return `${system} y Contica coinciden.`;
  const amount = formatCRC(Math.abs(difference));
  return difference > 0
    ? `Contica registra ${amount} más que ${system}.`
    : `${system} registra ${amount} más que Contica.`;
};

const tiemposStatusExplanation: Record<
  ClosingReconciliation["tiemposStatus"],
  string
> = {
  MATCHED: "Tiempos y Contica coinciden al finalizar el turno.",
  TEMPORARY_PENDING:
    "La diferencia queda pendiente para validarla en el cierre nocturno.",
  PARTIALLY_RESOLVED:
    "Se compensó una parte de la diferencia; todavía queda un saldo pendiente.",
  RESOLVED: "La diferencia del turno anterior quedó totalmente compensada.",
  REAL_DIFFERENCE: "Existe una diferencia real al finalizar el turno.",
  DAILY_UNRESOLVED: "El acumulado diario mantiene una diferencia sin resolver.",
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
    ? `
Saldos digitados en la verificación de sistemas:
 - Tucán — saldo acumulado: ${formatCRC(context.reconciliation.externalSnapshots.tucanCumulative)}
 - Contica — R08: ${formatCRC(context.reconciliation.contica.r08)}
 - Tiempos — saldo acumulado: ${formatCRC(context.reconciliation.externalSnapshots.tiemposCumulative)}
 - Contica — T11: ${formatCRC(context.reconciliation.contica.t11)}

Comparación del turno (Contica − sistema):
 - Tucán: R08 ${formatCRC(context.reconciliation.contica.r08)} − saldo del turno ${formatCRC(context.reconciliation.calculated.tucanForShift)} = ${formatCRC(context.reconciliation.calculated.tucanDifference)}
   ${explainSystemDifference("Tucán", context.reconciliation.calculated.tucanDifference)}
 - Tiempos: T11 ${formatCRC(context.reconciliation.contica.t11)} − saldo del turno ${formatCRC(context.reconciliation.calculated.tiemposForShift)} = ${formatCRC(context.reconciliation.calculated.tiemposRawDifference)}
   ${explainSystemDifference("Tiempos", context.reconciliation.calculated.tiemposRawDifference)}

Ajuste de Tiempos entre turnos:
 - Pendiente del turno anterior: ${formatCRC(context.reconciliation.calculated.previousTiemposPending)}
 - Diferencia del turno actual: ${formatCRC(context.reconciliation.calculated.tiemposRawDifference)}
 - Monto compensado: ${formatCRC(context.reconciliation.calculated.compensatedTiemposAmount)}
 - Diferencia final de Tiempos: ${formatCRC(context.reconciliation.calculated.tiemposDifference)}
 - Estado: ${tiemposStatusExplanation[context.reconciliation.tiemposStatus]}
`
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
${singleClosingReasonSection}${noMovementsSection}${reconciliationSection}${notesSection}`.trim();

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
                ? `<h3 style="margin: 16px 0 8px 0;">Saldos digitados en la verificación de sistemas</h3>
                    <p style="margin: 0 0 8px 0; color: #57606a;">Estos son los cuatro saldos ingresados por la persona encargada al realizar el cierre.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                        <thead>
                            <tr>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: left; background: #f6f8fa;">Sistema</th>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: left; background: #f6f8fa;">Dato digitado</th>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: right; background: #f6f8fa;">Saldo digitado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de;">Tucán</td><td style="padding: 8px; border: 1px solid #d0d7de;">Saldo acumulado</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;"><strong>${formatCRC(context.reconciliation.externalSnapshots.tucanCumulative)}</strong></td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de;">Contica</td><td style="padding: 8px; border: 1px solid #d0d7de;">R08</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;"><strong>${formatCRC(context.reconciliation.contica.r08)}</strong></td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de;">Tiempos</td><td style="padding: 8px; border: 1px solid #d0d7de;">Saldo acumulado</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;"><strong>${formatCRC(context.reconciliation.externalSnapshots.tiemposCumulative)}</strong></td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de;">Contica</td><td style="padding: 8px; border: 1px solid #d0d7de;">T11</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;"><strong>${formatCRC(context.reconciliation.contica.t11)}</strong></td></tr>
                        </tbody>
                    </table>
                    <h3 style="margin: 16px 0 8px 0;">Comparación del turno (Contica − sistema)</h3>
                    <p style="margin: 0 0 8px 0; color: #57606a;">Se compara el dato digitado de Contica con el saldo correspondiente únicamente a este turno.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                        <thead>
                            <tr>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: left; background: #f6f8fa;">Sistema</th>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: left; background: #f6f8fa;">Contica digitado</th>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: left; background: #f6f8fa;">Saldo del turno</th>
                                <th style="padding: 8px; border: 1px solid #d0d7de; text-align: left; background: #f6f8fa;">Resultado</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #d0d7de;"><strong>Tucán</strong></td>
                                <td style="padding: 8px; border: 1px solid #d0d7de;">R08: ${formatCRC(context.reconciliation.contica.r08)}</td>
                                <td style="padding: 8px; border: 1px solid #d0d7de;">${formatCRC(context.reconciliation.calculated.tucanForShift)}</td>
                                <td style="padding: 8px; border: 1px solid #d0d7de;"><strong>${formatCRC(context.reconciliation.calculated.tucanDifference)}</strong><br/><span style="color: #57606a;">${explainSystemDifference("Tucán", context.reconciliation.calculated.tucanDifference)}</span></td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #d0d7de;"><strong>Tiempos</strong></td>
                                <td style="padding: 8px; border: 1px solid #d0d7de;">T11: ${formatCRC(context.reconciliation.contica.t11)}</td>
                                <td style="padding: 8px; border: 1px solid #d0d7de;">${formatCRC(context.reconciliation.calculated.tiemposForShift)}</td>
                                <td style="padding: 8px; border: 1px solid #d0d7de;"><strong>${formatCRC(context.reconciliation.calculated.tiemposRawDifference)}</strong><br/><span style="color: #57606a;">${explainSystemDifference("Tiempos", context.reconciliation.calculated.tiemposRawDifference)}</span></td>
                            </tr>
                        </tbody>
                    </table>
                    <h3 style="margin: 16px 0 8px 0;">Ajuste de Tiempos entre turnos</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                        <tbody>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de; font-weight: 600;">Pendiente del turno anterior</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;">${formatCRC(context.reconciliation.calculated.previousTiemposPending)}</td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de; font-weight: 600;">Diferencia del turno actual</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;">${formatCRC(context.reconciliation.calculated.tiemposRawDifference)}</td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de; font-weight: 600;">Monto compensado</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;">${formatCRC(context.reconciliation.calculated.compensatedTiemposAmount)}</td></tr>
                            <tr><td style="padding: 8px; border: 1px solid #d0d7de; font-weight: 600;">Diferencia final de Tiempos</td><td style="padding: 8px; border: 1px solid #d0d7de; text-align: right;"><strong>${formatCRC(context.reconciliation.calculated.tiemposDifference)}</strong></td></tr>
                        </tbody>
                    </table>
                    <p style="margin: 0 0 16px 0;"><strong>Estado:</strong> ${tiemposStatusExplanation[context.reconciliation.tiemposStatus]}</p>`
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
