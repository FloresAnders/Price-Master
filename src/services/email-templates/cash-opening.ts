export type CashOpeningEmailContext = {
  company: string;
  accountKey: string;
  openingDateISO: string;
  manager: string;
  totalCRC: number;
  totalUSD: number;
  diffCRC: number;
  diffUSD: number;
  notes?: string;
  breakdownCRC?: Record<string, number>;
  breakdownUSD?: Record<string, number>;
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

const formatBreakdown = (breakdown?: Record<string, number>) => {
  if (!breakdown) return "N/A";
  const entries = Object.entries(breakdown)
    .filter(([, count]) => Number(count) > 0)
    .map(([denom, count]) => `${denom}: ${count}`);
  return entries.length > 0 ? entries.join("\n") : "N/A";
};

const formatBreakdownHTML = (breakdown?: Record<string, number>) => {
  if (!breakdown) return "<li>N/A</li>";
  const entries = Object.entries(breakdown)
    .filter(([, count]) => Number(count) > 0)
    .map(([denom, count]) => `<li>₡${denom}: ${count}</li>`);
  return entries.length > 0 ? entries.join("") : "<li>N/A</li>";
};

const formatBreakdownUSDHTML = (breakdown?: Record<string, number>) => {
  if (!breakdown) return "<li>N/A</li>";
  const entries = Object.entries(breakdown)
    .filter(([, count]) => Number(count) > 0)
    .map(([denom, count]) => `<li>$${denom}: ${count}</li>`);
  return entries.length > 0 ? entries.join("") : "<li>N/A</li>";
};

export const buildCashOpeningEmailTemplate = (
  context: CashOpeningEmailContext,
): EmailTemplate => {
  const openingDate = new Date(context.openingDateISO);
  const dateLabel = new Intl.DateTimeFormat("es-CR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(openingDate);

  const subject = `Nueva apertura de fondo — ${context.company}`;

  const hasDifferences = context.diffCRC !== 0 || context.diffUSD !== 0;
  const notesSection =
    context.notes && context.notes.trim().length > 0
      ? `Notas:\n${context.notes.trim()}\n`
      : "";

  const text = `Se registró una nueva apertura de fondo en Time Master.

Empresa: ${context.company}
Cuenta: ${context.accountKey}
Fecha: ${dateLabel}
Encargado: ${context.manager}

Saldo de apertura:
 - Colones: ${formatCurrency("CRC", context.totalCRC)}
 - Dólares: ${formatCurrency("USD", context.totalUSD)}

Diferencias:
 - Colones: ${formatDiff("CRC", context.diffCRC)}
 - Dólares: ${formatDiff("USD", context.diffUSD)}

Desglose de billetes:
 - Colones:
${formatBreakdown(context.breakdownCRC)
  .split("\n")
  .map((l) => `   ${l}`)
  .join("\n")}
 - Dólares:
${formatBreakdown(context.breakdownUSD)
  .split("\n")
  .map((l) => `   ${l}`)
  .join("\n")}
${notesSection}${hasDifferences ? "\nMotivo: AJUSTE APLICADO AL SALDO DE APERTURA" : ""}`.trim();

  const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1b1f23;">
            <h2 style="margin-bottom: 12px;">Nueva apertura de fondo registrada</h2>
            <p style="margin: 0 0 12px 0;">Se registró una apertura para <strong>${context.company}</strong> en la cuenta <strong>${context.accountKey}</strong>.</p>
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
            <h3 style="margin: 16px 0 8px 0;">Saldo de apertura</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: <strong>${formatCurrency("CRC", context.totalCRC)}</strong></li>
                <li>Dólares: <strong>${formatCurrency("USD", context.totalUSD)}</strong></li>
            </ul>
            <h3 style="margin: 16px 0 8px 0;">Diferencias</h3>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                <li>Colones: ${formatDiff("CRC", context.diffCRC)}</li>
                <li>Dólares: ${formatDiff("USD", context.diffUSD)}</li>
            </ul>
            <h3 style="margin: 16px 0 8px 0;">Desglose de billetes</h3>
            <h4 style="margin: 8px 0 4px 0;">Colones</h4>
            <ul style="margin: 0 0 12px 16px; padding: 0;">
                ${formatBreakdownHTML(context.breakdownCRC)}
            </ul>
            <h4 style="margin: 8px 0 4px 0;">Dólares</h4>
            <ul style="margin: 0 0 16px 16px; padding: 0;">
                ${formatBreakdownUSDHTML(context.breakdownUSD)}
            </ul>
            ${
              context.notes && context.notes.trim().length > 0
                ? `<div style="border-left: 4px solid #0366d6; background: #f1f8ff; padding: 12px 16px; border-radius: 6px;">
                        <strong>Notas:</strong>
                        <p style="margin: 8px 0 0 0; white-space: pre-line;">${context.notes.trim()}</p>
                    </div>`
                : ""
            }
            ${
              hasDifferences
                ? `<div style="border-left: 4px solid #d73a49; background: #ffeef0; padding: 12px 16px; border-radius: 6px; margin-top: 12px;">
                        <strong>Motivo:</strong> AJUSTE APLICADO AL SALDO DE APERTURA
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
