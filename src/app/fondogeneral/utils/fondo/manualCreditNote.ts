import type { FondoEntry } from "../../types";
import { formatByCurrency, roundMoney2 } from "../helpers";
import {
  appendManualCreditNoteDraft,
  type ManualCreditNoteDraft,
} from "./manualCreditNoteDrafts";

export interface SaveManualCreditNoteDeps {
  manualCreditNoteTarget: FondoEntry | null;
  company: string | null;
  manualCreditNoteInvoiceNumber: string;
  manualCreditNoteAmount: string;
  manualCreditNoteObservation: string;
  setManualCreditNoteError: (value: string) => void;
  setManualCreditNoteSaving: (value: boolean) => void;
  manualCreditNoteDrafts: ManualCreditNoteDraft[];
  setManualCreditNoteDrafts: (
    value:
      | ManualCreditNoteDraft[]
      | ((prev: ManualCreditNoteDraft[]) => ManualCreditNoteDraft[]),
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
    roundMoney2(deps.manualCreditNoteAmount),
  );
  if (amountValue <= 0) {
    deps.setManualCreditNoteError("Ingresa un monto mayor a cero.");
    return;
  }

  const observationValue = String(deps.manualCreditNoteObservation || "").trim();

  const targetCurrency = (target.currency as "CRC" | "USD") || "CRC";
  const targetBaseAmount = Math.max(
    0,
    roundMoney2(target.amountEgreso || target.amountIngreso),
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
    const result = appendManualCreditNoteDraft(
      deps.manualCreditNoteDrafts,
      {
        invoiceNumber: invoiceNumberValue,
        amount: amountValue,
        observation: observationValue || undefined,
      },
      [],
    );
    const [nextDraft] = result.drafts.slice(-1);
    deps.setManualCreditNoteDrafts(result.drafts);
    deps.setSelectedAppliedCreditNoteIds((prev) =>
      nextDraft && !prev.includes(nextDraft.id) ? [...prev, nextDraft.id] : prev,
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
