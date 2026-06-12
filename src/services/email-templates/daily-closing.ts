import { MovementAccountKey } from "../movimientos-fondos";

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
  sistemas?: {
    conticaCRC: number;
    tucanCRC?: number;
    tiemposCRC?: number;
    conticaTiemposCRC?: number;
    diffCRC?: number;
    diffTiemposCRC?: number;
    conticaAjustadaCRC?: number;
    conticaTiemposAjustadaCRC?: number;
    tucanAjustadaCRC?: number;
    tiemposAjustadaCRC?: number;
  } | null;
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

const renderVerificationMatrixRow = (
  label: string,
  conticaAmount?: number,
  serviceAmount?: number,
  diffAmount?: number,
  striped = false,
) => `
    <tr${striped ? ` style="background: #f6f8fa;"` : ""}>
      <td style="padding: 4px 8px; border: 1px solid #000;">${label}</td>
      <td style="padding: 4px 8px; border: 1px solid #000; text-align: right;">${typeof conticaAmount === "number" ? formatCurrency("CRC", conticaAmount) : ""}</td>
      <td style="padding: 4px 8px; border: 1px solid #000; text-align: right;">${typeof serviceAmount === "number" ? formatCurrency("CRC", serviceAmount) : ""}</td>
      <td style="padding: 4px 8px; border: 1px solid #000; text-align: right;">${typeof diffAmount === "number" ? formatCurrency("CRC", diffAmount) : ""}</td>
    </tr>
  `;

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

  const sistemasSectionTextExtended = context.sistemas
    ? `
Verificacion de sistemas:
 - Contica: ${formatCurrency("CRC", context.sistemas.conticaCRC)}
 ${typeof context.sistemas.tucanCRC === "number" ? ` - Tucan: ${formatCurrency("CRC", context.sistemas.tucanCRC)}\n` : ""}
 ${typeof context.sistemas.tiemposCRC === "number" ? ` - Tiempos: ${formatCurrency("CRC", context.sistemas.tiemposCRC)}\n` : ""}
 ${typeof context.sistemas.conticaAjustadaCRC === "number" ? ` - Contica ajustada: ${formatCurrency("CRC", context.sistemas.conticaAjustadaCRC)}\n` : ""}
 ${typeof context.sistemas.tucanAjustadaCRC === "number" ? ` - Tucan ajustada: ${formatCurrency("CRC", context.sistemas.tucanAjustadaCRC)}\n` : ""}
 ${typeof context.sistemas.tiemposAjustadaCRC === "number" ? ` - Tiempos ajustado: ${formatCurrency("CRC", context.sistemas.tiemposAjustadaCRC)}\n` : ""}
 ${typeof (context.sistemas as any).conticaTiemposCRC === "number" ? ` - Contica (Tiempos): ${formatCurrency("CRC", (context.sistemas as any).conticaTiemposCRC)}\n` : ""}
 ${typeof context.sistemas.diffCRC === "number" ? ` - Diferencia (Contica-Tucan): ${formatCurrency("CRC", context.sistemas.diffCRC)}\n` : ""}
 ${typeof context.sistemas.diffTiemposCRC === "number" ? ` - Diferencia (Contica-Tiempos): ${formatCurrency("CRC", context.sistemas.diffTiemposCRC)}\n` : ""}
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
${singleClosingReasonSection}${noMovementsSection}${notesSection}`.trim();

  const textWithSistemas = sistemasSectionTextExtended
    ? `${text}\n${sistemasSectionTextExtended}`
    : text;

  const sistemasHtmlSection = context.sistemas
    ? `
            <h3 style="margin: 16px 0 8px 0;">Verificacion de sistemas</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
              <thead>
                <tr style="background: #d9d9d9;">
                  <th style="padding: 4px 8px; border: 1px solid #000; text-align: left;">Sistema</th>
                  <th style="padding: 4px 8px; border: 1px solid #000; text-align: right;">CONTICA</th>
                  <th style="padding: 4px 8px; border: 1px solid #000; text-align: right;">SERVICIO</th>
                  <th style="padding: 4px 8px; border: 1px solid #000; text-align: right;">DIFERENCIA</th>
                </tr>
              </thead>
              <tbody>
                ${renderVerificationMatrixRow(
                  "TUCAN",
                  context.sistemas.conticaAjustadaCRC ?? context.sistemas.conticaCRC,
                  context.sistemas.tucanAjustadaCRC ?? context.sistemas.tucanCRC,
                  context.sistemas.diffCRC,
                )}
                ${renderVerificationMatrixRow(
                  "TIEMPOS",
                  (context.sistemas as any).conticaTiemposAjustadaCRC ??
                    (context.sistemas as any).conticaTiemposCRC ??
                    context.sistemas.conticaAjustadaCRC ??
                    context.sistemas.conticaCRC,
                  context.sistemas.tiemposAjustadaCRC ?? context.sistemas.tiemposCRC,
                  context.sistemas.diffTiemposCRC,
                  true,
                )}
              </tbody>
            </table>
          `
    : "";

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
            ${sistemasHtmlSection}
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
    text: textWithSistemas,
    html,
  };
};
