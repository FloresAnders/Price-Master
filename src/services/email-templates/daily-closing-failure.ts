export type DailyClosingFailureOutcome = "blocked" | "partial";

export interface DailyClosingFailureAlertInput {
  company: string;
  accountKey: string;
  attemptedAtISO: string;
  closingDateISO: string;
  userEmail: string;
  manager: string;
  turno?: "D" | "N";
  sinTurno?: boolean;
  totalCRC: number;
  totalUSD: number;
  currentBalanceCRC: number | null;
  currentBalanceUSD: number | null;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
  r08: number;
  t11: number;
  tucanCumulative: number;
  tiemposCumulative: number;
  notes: string;
  phase: string;
  outcome: DailyClosingFailureOutcome;
  reason: string;
  userNotification: string | null;
  technicalDetails?: string;
}

export interface DailyClosingFailureMailJob {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const DAILY_CLOSING_FAILURE_RECIPIENTS = [
  "chavesa698@gmail.com",
  "price.master.srl@gmail.com",
] as const;

const formatCurrency = (currency: "CRC" | "USD", value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  const [integer, decimals] = Math.abs(rounded).toFixed(2).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const amount = decimals === "00" ? grouped : `${grouped},${decimals}`;
  return `${sign}${currency === "USD" ? "US$" : "₡"}${amount}`;
};

const formatOptionalCurrency = (
  currency: "CRC" | "USD",
  value: number | null,
): string =>
  typeof value === "number" && Number.isFinite(value)
    ? formatCurrency(currency, value)
    : "No disponible";

const formatDifference = (
  currency: "CRC" | "USD",
  total: number,
  balance: number | null,
): string => {
  if (typeof balance !== "number" || !Number.isFinite(balance)) {
    return "No disponible";
  }
  const difference = total - balance;
  if (difference === 0) return "Sin diferencias";
  return `${difference > 0 ? "+" : "-"} ${formatCurrency(
    currency,
    Math.abs(difference),
  )}`;
};

const formatBreakdown = (
  currency: "CRC" | "USD",
  breakdown: Record<number, number>,
): string => {
  const rows = Object.entries(breakdown)
    .map(([denomination, count]) => [Number(denomination), Number(count)] as const)
    .filter(([denomination, count]) =>
      Number.isFinite(denomination) && Number.isFinite(count),
    )
    .sort(([left], [right]) => right - left)
    .map(
      ([denomination, count]) =>
        ` - ${formatCurrency(currency, denomination)}: ${count}`,
    );
  return rows.length > 0 ? rows.join("\n") : " - Sin datos";
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });

const textToHtml = (text: string): string =>
  escapeHtml(text).replace(/\n/g, "<br />");

const formatCostaRicaDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || "No disponible";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, " ");
};

const buildFailureText = (input: DailyClosingFailureAlertInput): string => {
  const technicalDetails = input.technicalDetails?.trim()
    ? `\nDetalle técnico: ${input.technicalDetails.trim()}`
    : "";
  const turno = input.sinTurno ? "Sin turno" : input.turno ?? "No indicado";
  const userNotification = input.userNotification?.trim()
    ? input.userNotification.trim()
    : "No se mostró ninguna notificación al usuario.";

  return [
    input.outcome === "partial"
      ? "Un cierre de Fondo General quedó incompleto."
      : "No se pudo realizar un cierre de Fondo General.",
    "",
    `Empresa: ${input.company || "No disponible"}`,
    `Cuenta: ${input.accountKey || "FondoGeneral"}`,
    `Hora Costa Rica: ${formatCostaRicaDateTime(input.attemptedAtISO)}`,
    `Hora ISO: ${input.attemptedAtISO}`,
    `Fecha seleccionada del cierre: ${input.closingDateISO}`,
    `Usuario: ${input.userEmail || "No disponible"}`,
    `Encargado: ${input.manager || "No indicado"}`,
    `Turno: ${turno}`,
    `Fase: ${input.phase}`,
    "",
    "Totales y diferencias:",
    ` - Total contado CRC: ${formatCurrency("CRC", input.totalCRC)}`,
    ` - Saldo del ledger CRC: ${formatOptionalCurrency("CRC", input.currentBalanceCRC)}`,
    ` - Diferencia CRC: ${formatDifference("CRC", input.totalCRC, input.currentBalanceCRC)}`,
    ` - Total contado USD: ${formatCurrency("USD", input.totalUSD)}`,
    ` - Saldo del ledger USD: ${formatOptionalCurrency("USD", input.currentBalanceUSD)}`,
    ` - Diferencia USD: ${formatDifference("USD", input.totalUSD, input.currentBalanceUSD)}`,
    "",
    "Conteo de billetes y monedas CRC:",
    formatBreakdown("CRC", input.breakdownCRC),
    "",
    "Conteo de billetes USD:",
    formatBreakdown("USD", input.breakdownUSD),
    "",
    "Verificación de sistemas:",
    ` - R08: ${formatCurrency("CRC", input.r08)}`,
    ` - TT / T11: ${formatCurrency("CRC", input.t11)}`,
    ` - Tucán acumulado: ${formatCurrency("CRC", input.tucanCumulative)}`,
    ` - Tiempos acumulado: ${formatCurrency("CRC", input.tiemposCumulative)}`,
    "",
    `Observaciones: ${input.notes?.trim() || "Sin observaciones"}`,
    "",
    `Notificación mostrada al usuario: ${userNotification}`,
    "",
    `Motivo exacto: ${input.reason}${technicalDetails}`,
  ].join("\n");
};

export const buildDailyClosingFailureMailJobs = (
  input: DailyClosingFailureAlertInput,
): DailyClosingFailureMailJob[] => {
  const outcomeLabel =
    input.outcome === "partial" ? "CIERRE INCOMPLETO" : "CIERRE BLOQUEADO";
  const subject = `[ALERTA][${outcomeLabel}] ${input.company || "Empresa no disponible"}`;
  const text = buildFailureText(input);
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="color: #b91c1c;">${escapeHtml(subject)}</h2>
      <p style="white-space: normal;">${textToHtml(text)}</p>
    </div>
  `.trim();

  return DAILY_CLOSING_FAILURE_RECIPIENTS.map((to) => ({
    to,
    subject,
    text,
    html,
  }));
};

export const deliverDailyClosingFailureMailJobs = async (
  jobs: DailyClosingFailureMailJob[],
  deliver: (job: DailyClosingFailureMailJob) => Promise<void>,
): Promise<{ delivered: string[]; failed: string[] }> => {
  const results = await Promise.allSettled(jobs.map((job) => deliver(job)));
  return results.reduce<{ delivered: string[]; failed: string[] }>(
    (summary, result, index) => {
      const recipient = jobs[index]?.to;
      if (!recipient) return summary;
      summary[result.status === "fulfilled" ? "delivered" : "failed"].push(
        recipient,
      );
      return summary;
    },
    { delivered: [], failed: [] },
  );
};
