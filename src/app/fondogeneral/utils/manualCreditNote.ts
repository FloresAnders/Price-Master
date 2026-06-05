import type { FondoEntry } from "../types";
import { formatByCurrency } from "../utils/helpers";

export interface SaveManualCreditNoteDeps {
  manualCreditNoteTarget: FondoEntry | null;
  company: string | null;
  manualCreditNoteInvoiceNumber: string;
  manualCreditNoteAmount: string;
  manualCreditNoteObservation: string;
  setManualCreditNoteError: (value: string) => void;
  setManualCreditNoteSaving: (value: boolean) => void;
  setManualCreditNoteDraft: (
    value:
      | {
          invoiceNumber: string;
          amount: number;
          observation?: string;
        }
      | null
      | ((prev: {
          invoiceNumber: string;
          amount: number;
          observation?: string;
        } | null) => {
          invoiceNumber: string;
          amount: number;
          observation?: string;
        } | null),
  ) => void;
  setSelectedAppliedCreditNoteIds: (
    value: string[] | ((prev: string[]) => string[]),
  ) => void;
  showToast: (
    msg: string,
    type?: "success" | "error" | "info" | "warning",
    duration?: number,
  ) => void;
  closeManualCreditNoteModal: () => void;
}

export async function handleSaveManualCreditNote(
  deps: SaveManualCreditNoteDeps,
): Promise<void> {
  const target = deps.manualCreditNoteTarget;
  if (!target) return;

  const normalizedCompany = (deps.company || "").trim();
  if (!normalizedCompany) {
    deps.setManualCreditNoteError("No se pudo determinar la empresa.");
    return;
  }

  const invoiceNumberValue = String(deps.manualCreditNoteInvoiceNumber || "")
    .trim()
    .toUpperCase();
  if (!/^[0-9]{1,4}$/.test(invoiceNumberValue)) {
    deps.setManualCreditNoteError(
      "Ingresa un número de factura válido (1-4 dígitos).",
    );
    return;
  }

  const amountValue = Math.max(
    0,
    Math.trunc(Number(deps.manualCreditNoteAmount) || 0),
  );
  if (amountValue <= 0) {
    deps.setManualCreditNoteError("Ingresa un monto mayor a cero.");
    return;
  }

  const observationValue = String(deps.manualCreditNoteObservation || "").trim();

  const targetCurrency = (target.currency as "CRC" | "USD") || "CRC";
  const targetBaseAmount = Math.max(
    0,
    Math.trunc(Number(target.amountEgreso || target.amountIngreso) || 0),
  );

  if (amountValue > targetBaseAmount) {
    deps.setManualCreditNoteError(
      `El monto supera el saldo disponible para aplicar (${formatByCurrency(
        targetCurrency,
        targetBaseAmount,
      )}).`,
    );
    return;
  }

  deps.setManualCreditNoteSaving(true);
  deps.setManualCreditNoteError("");
  try {
    deps.setManualCreditNoteDraft({
      invoiceNumber: invoiceNumberValue,
      amount: amountValue,
      observation: observationValue || undefined,
    });
    // Marcar la NC manual como seleccionada para que aparezca inmediatamente
    deps.setSelectedAppliedCreditNoteIds((prev) =>
      prev && prev.includes("manual-nc-draft")
        ? prev
        : [...(prev || []), "manual-nc-draft"],
    );
    deps.showToast("Nota de crédito manual lista para guardar", "success", 3000);
    deps.closeManualCreditNoteModal();
  } catch (error) {
    console.error("[FG] Error saving manual credit note:", error);
    deps.setManualCreditNoteError("No se pudo guardar la nota de crédito.");
  } finally {
    deps.setManualCreditNoteSaving(false);
  }
}
