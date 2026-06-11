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
  sistemas?: {
    conticaCRC: number;
    tucanCRC?: number;
    tiemposCRC?: number;
    conticaTiemposCRC?: number;
    diffCRC?: number; // contica - tucan
    diffTiemposCRC?: number; // contica - tiempos
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

export const buildDailyClosingEmailTemplate = (
  context: DailyClosingEmailContext,
): EmailTemplate => {
  const closingDate = new Date(context.closingDateISO);
  const dateLabel = new Intl.DateTimeFormat("es-CR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(closingDate);

  const subject = `Nuevo cierre diario — ${context.company}`;

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

  const sistemasSectionText = context.sistemas
    ? `
Verificación de sistemas:
  - Contica: ${formatCurrency("CRC", context.sistemas.conticaCRC)}
 - Tucan: ${formatCurrency("CRC", context.sistemas.tucanCRC ?? 0)}
  - Contica (Tiempos): ${formatCurrency("CRC", (context.sistemas as any).conticaTiemposCRC ?? 0)}
 - Contica ajustada: ${formatCurrency("CRC", context.sistemas.conticaAjustadaCRC ?? 0)}
 - Diferencia: ${formatCurrency("CRC", context.sistemas.diffCRC ?? 0)}
`
    : "";
  const sistemasSectionTextExtended = context.sistemas
    ? `
Verificación de sistemas:
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

  const text = `Se registró un nuevo cierre diario en Time Master.

Empresa: ${context.company}
Cuenta: ${context.accountKey}
Fecha: ${dateLabel}
Encargado: ${context.manager}

Totales declarados:
 - Colones: ${formatCurrency("CRC", context.totalCRC)}
 - Dólares: ${formatCurrency("USD", context.totalUSD)}

Saldos registrados en sistema:
 - Colones: ${formatCurrency("CRC", context.recordedBalanceCRC)}
 - Dólares: ${formatCurrency("USD", context.recordedBalanceUSD)}

Diferencias:
 - Colones: ${formatDiff("CRC", context.diffCRC)}
 - Dólares: ${formatDiff("USD", context.diffUSD)}
${singleClosingReasonSection}${notesSection}`.trim();

  const textWithSistemas = sistemasSectionTextExtended ? `${text}\n${sistemasSectionTextExtended}` : text;

  const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1b1f23;">
            <h2 style="margin-bottom: 12px;">Nuevo cierre diario registrado</h2>
            <p style="margin: 0 0 12px 0;">Se registró un cierre para <strong>${context.company}</strong> en la cuenta <strong>Fondo General</strong>.</p>
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
                <li>Dólares: <strong>${formatCurrency("USD", context.totalUSD)}</strong></li>
            </ul>
            <h3 style="margin: 16px 0 8px 0;">Saldos registrados</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: ${formatCurrency("CRC", context.recordedBalanceCRC)}</li>
                <li>Dólares: ${formatCurrency("USD", context.recordedBalanceUSD)}</li>
            </ul>
            <h3 style="margin: 16px 0 8px 0;">Diferencias</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: ${formatDiff("CRC", context.diffCRC)}</li>
                <li>Dólares: ${formatDiff("USD", context.diffUSD)}</li>
            </ul>
            ${
              context.singleClosingReason && context.singleClosingReason.trim().length > 0
                ? `<div style="border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                        <strong>Motivo cierre unico:</strong>
                        <p style="margin: 8px 0 0 0; white-space: pre-line;">${context.singleClosingReason.trim()}</p>
                    </div>`
                : ""
            }
            ${context.sistemas ? `
            <h3 style="margin: 16px 0 8px 0;">Verificación de sistemas</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
              <li>Contica: <strong>${formatCurrency("CRC", context.sistemas.conticaCRC)}</strong></li>
              ${typeof (context.sistemas as any).conticaTiemposCRC === "number" ? `<li>Contica (Tiempos): <strong>${formatCurrency("CRC", (context.sistemas as any).conticaTiemposCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.tucanCRC === "number" ? `<li>Tucan: <strong>${formatCurrency("CRC", context.sistemas.tucanCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.tiemposCRC === "number" ? `<li>Tiempos: <strong>${formatCurrency("CRC", context.sistemas.tiemposCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.conticaAjustadaCRC === "number" ? `<li>Contica ajustada: <strong>${formatCurrency("CRC", context.sistemas.conticaAjustadaCRC)}</strong></li>` : ""}
              ${typeof (context.sistemas as any).conticaTiemposAjustadaCRC === "number" ? `<li>Contica (Tiempos) ajustada: <strong>${formatCurrency("CRC", (context.sistemas as any).conticaTiemposAjustadaCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.tucanAjustadaCRC === "number" ? `<li>Tucan ajustada: <strong>${formatCurrency("CRC", context.sistemas.tucanAjustadaCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.tiemposAjustadaCRC === "number" ? `<li>Tiempos ajustado: <strong>${formatCurrency("CRC", context.sistemas.tiemposAjustadaCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.diffCRC === "number" ? `<li>Diferencia (Contica-Tucan): <strong>${formatCurrency("CRC", context.sistemas.diffCRC)}</strong></li>` : ""}
              ${typeof context.sistemas.diffTiemposCRC === "number" ? `<li>Diferencia (Contica-Tiempos): <strong>${formatCurrency("CRC", context.sistemas.diffTiemposCRC)}</strong></li>` : ""}
            </ul>
            ` : ""}
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
