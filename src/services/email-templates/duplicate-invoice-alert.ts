export type DuplicateInvoiceAlertMovement = {
  providerName: string;
  manager: string;
  amount: number;
  currency: "CRC" | "USD";
  createdAt: string;
  notes?: string;
};

export type DuplicateInvoiceAlertTemplateData = {
  company: string;
  invoiceNumber: string;
  currentMovement: DuplicateInvoiceAlertMovement;
  previousMovement: DuplicateInvoiceAlertMovement;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatMoney = (currency: "CRC" | "USD", amount: number) => {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("sv-SE");
};

export const buildDuplicateInvoiceAlertEmailTemplate = (
  data: DuplicateInvoiceAlertTemplateData,
): { subject: string; text: string; html: string } => {
  const companyLabel = data.company || "N/A";
  const subject = `[ALERTA] Numero de factura repetido (${data.invoiceNumber}) - ${companyLabel || "Empresa"}`;

  const currentDate = formatDate(data.currentMovement.createdAt);
  const previousDate = formatDate(data.previousMovement.createdAt);
  const currentNotes = data.currentMovement.notes?.trim() || "(sin notas)";
  const previousNotes = data.previousMovement.notes?.trim() || "(sin notas)";

  const text = [
    "Se detecto un Numero de factura repetido en movimiento de tipo COMPRA DE INVENTARIO.",
    "",
    `Empresa: ${companyLabel}`,
    `Numero Factura: ${data.invoiceNumber}`,
    "",
    "Movimiento actual:",
    `- Proveedor: ${data.currentMovement.providerName}`,
    `- Encargado: ${data.currentMovement.manager}`,
    `- Monto: ${formatMoney(
      data.currentMovement.currency,
      data.currentMovement.amount,
    )}`,
    `- Fecha: ${currentDate}`,
    `- Notas: ${currentNotes}`,
    "",
    "Movimiento anterior con mismo invoice:",
    `- Proveedor: ${data.previousMovement.providerName}`,
    `- Encargado: ${data.previousMovement.manager}`,
    `- Monto: ${formatMoney(
      data.previousMovement.currency,
      data.previousMovement.amount,
    )}`,
    `- Fecha: ${previousDate}`,
    `- Notas: ${previousNotes}`,
  ].join("\n");

  const html = `
    <h2>Alerta de invoice repetido</h2>
    <p>Se detecto un numero de factura repetido en un movimiento de tipo <strong>COMPRA DE INVENTARIO</strong>.</p>
    <p><strong>Empresa:</strong> ${escapeHtml(companyLabel)}<br/>
    <strong>Numero Factura:</strong> ${escapeHtml(data.invoiceNumber)}</p>
    <h3>Movimiento actual</h3>
    <ul>
      <li><strong>Proveedor:</strong> ${escapeHtml(data.currentMovement.providerName)}</li>
      <li><strong>Encargado:</strong> ${escapeHtml(data.currentMovement.manager)}</li>
      <li><strong>Monto:</strong> ${escapeHtml(
        formatMoney(data.currentMovement.currency, data.currentMovement.amount),
      )}</li>
      <li><strong>Fecha:</strong> ${escapeHtml(currentDate)}</li>
      <li><strong>Notas:</strong> ${escapeHtml(currentNotes)}</li>
    </ul>
    <h3>Movimiento anterior</h3>
    <ul>
      <li><strong>Proveedor:</strong> ${escapeHtml(data.previousMovement.providerName)}</li>
      <li><strong>Encargado:</strong> ${escapeHtml(data.previousMovement.manager)}</li>
      <li><strong>Monto:</strong> ${escapeHtml(
        formatMoney(data.previousMovement.currency, data.previousMovement.amount),
      )}</li>
      <li><strong>Fecha:</strong> ${escapeHtml(previousDate)}</li>
      <li><strong>Notas:</strong> ${escapeHtml(previousNotes)}</li>
    </ul>
  `;

  return { subject, text, html };
};