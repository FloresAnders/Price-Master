export type FcrPaymentRecovery = {
  company: string;
  mainMovementId: string;
  invoiceNumbers: string[];
};

export function reportFcrPaymentAfterMainSaveFailure(input: FcrPaymentRecovery & {
  mainMovementId: string;
  invoiceNumbers: string[];
  showToast: (message: string, type: "error", durationMs: number) => void;
  clearSelection: () => void;
  setRecovery: (recovery: FcrPaymentRecovery) => void;
}): void {
  input.clearSelection();
  input.setRecovery({
    company: input.company,
    mainMovementId: input.mainMovementId,
    invoiceNumbers: input.invoiceNumbers,
  });
  const invoices = input.invoiceNumbers.length > 0
    ? ` (${input.invoiceNumbers.join(", ")})`
    : "";
  input.showToast(
    `El movimiento ${input.mainMovementId} quedó guardado, pero no se aplicó el pago de las facturas${invoices}. No vuelva a guardar el movimiento. Revise los saldos y pague las facturas pendientes desde Facturas / FC-NC.`,
    "error",
    12000,
  );
}
