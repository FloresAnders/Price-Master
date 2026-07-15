export const PAYMENT_METHODS = ["efectivo", "transferencia", "cheque"];
export const normalizeCurrency = (value) => value === "USD" ? "USD" : "CRC";

const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const localDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
};

export const costaRicaDateKey = (value = new Date()) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = localDate(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

export const costaRicaDayContext = (value = new Date()) => {
  const dateKey = costaRicaDateKey(value);
  return { dateKey, start: new Date(`${dateKey}T00:00:00-06:00`) };
};

export const validatePayment = ({ amount, balance }) => {
  const normalizedAmount = cents(amount);
  const normalizedBalance = cents(balance);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { valid: false, error: "El pago debe ser mayor que cero." };
  }
  if (!Number.isFinite(normalizedBalance) || normalizedBalance <= 0) {
    return { valid: false, error: "La factura no tiene saldo pendiente." };
  }
  if (normalizedAmount > normalizedBalance) {
    return { valid: false, error: "El pago supera el saldo pendiente." };
  }
  return { valid: true, amount: normalizedAmount };
};

export const deriveInvoiceStatus = ({ total, paid, dueAt, now = new Date() }) => {
  const normalizedTotal = Math.max(0, cents(total) || 0);
  const normalizedPaid = Math.max(0, cents(paid) || 0);
  if (normalizedTotal > 0 && normalizedPaid >= normalizedTotal) return "Pagada";
  const dueDay = costaRicaDateKey(dueAt);
  const currentDay = costaRicaDateKey(now);
  if (dueDay < currentDay) return "Vencida";
  return normalizedPaid > 0 ? "Parcial" : "Pendiente";
};

export const applyPaymentAmounts = ({ total, paid, amount, dueAt, now }) => {
  const normalizedTotal = cents(total);
  const currentPaid = cents(paid || 0);
  const validation = validatePayment({ amount, balance: normalizedTotal - currentPaid });
  if (!validation.valid) throw new Error(validation.error);
  const nextPaid = cents(currentPaid + validation.amount);
  const balance = Math.max(0, cents(normalizedTotal - nextPaid));
  return {
    amount: validation.amount,
    paid: nextPaid,
    balance,
    status: deriveInvoiceStatus({ total: normalizedTotal, paid: nextPaid, dueAt, now }),
  };
};

export const calculateTotals = (invoices, now = new Date(), upcomingDays = 7) => {
  const currentDay = costaRicaDateKey(now);
  const upcomingEnd = costaRicaDateKey(new Date(localDate(now).getTime() + upcomingDays * 86_400_000));
  return invoices.reduce((totals, invoice) => {
    const balance = Math.max(0, cents(invoice.saldo ?? invoice.balance ?? 0) || 0);
    const paid = Math.max(0, cents(invoice.pagado ?? invoice.paid ?? 0) || 0);
    const rawDue = invoice.fechaVencimiento ?? invoice.dueAt;
    const dueDate = rawDue?.toDate ? rawDue.toDate() : rawDue;
    const dueDay = costaRicaDateKey(dueDate);
    totals.total = cents(totals.total + balance);
    totals.pagado = cents(totals.pagado + paid);
    totals.cantidad += 1;
    if (balance > 0 && dueDay < currentDay) totals.vencido = cents(totals.vencido + balance);
    if (balance > 0 && dueDay === currentDay) totals.venceHoy = cents(totals.venceHoy + balance);
    if (balance > 0 && dueDay > currentDay && dueDay <= upcomingEnd) {
      totals.proximoAVencer = cents(totals.proximoAVencer + balance);
    }
    return totals;
  }, { total: 0, vencido: 0, venceHoy: 0, proximoAVencer: 0, pagado: 0, cantidad: 0 });
};
