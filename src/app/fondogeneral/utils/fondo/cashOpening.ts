import type { Dispatch, SetStateAction } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { getAuthoritativeNowISO } from "@/utils/serverTime";
import {
  compressAuditHistory,
  dateKeyFromDate,
  formatByCurrency,
  getChangedFields,
} from "../helpers";
import { APERTURA_FONDO_PROVIDER_CODE, AUTO_ADJUSTMENT_OPENING_TYPE } from "../../constants";
import type { FondoEntry } from "../../types";
import type { CashOpeningFormValues } from "../../components/modals/CashOpeningModal";

type ShowToast = (
  message: string,
  kind?: "success" | "warning" | "error" | "info",
  durationMs?: number,
) => void;

export interface HandleConfirmCashOpeningDeps {
  accountKey: string;
  company: string | null | undefined;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  buildPhysicalCountStorageKey: () => string | null;
  cleanupPhysicalCountLegacyKeys: () => void;
  persistMovementToFirestore: any;
  fondoEntries: FondoEntry[];
  setFondoEntries: Dispatch<SetStateAction<FondoEntry[]>>;
  setLedgerSnapshot: any;
  showToast: ShowToast;
  ownerAdminEmail?: string | null;
  user?: { email?: string | null } | null;
  setCashOpeningModalOpen: (value: boolean) => void;
  setCashOpeningInitialValues: (value: CashOpeningFormValues | null) => void;
  openingSubmitInProgressRef: { current: boolean };
  existingEntry?: FondoEntry | null;
}

export async function handleConfirmCashOpening(
  opening: CashOpeningFormValues,
  deps: HandleConfirmCashOpeningDeps,
) {
  const {
    accountKey,
    company,
    currentBalanceCRC,
    currentBalanceUSD,
    buildPhysicalCountStorageKey,
    cleanupPhysicalCountLegacyKeys,
    persistMovementToFirestore,
    fondoEntries,
    setFondoEntries,
    setLedgerSnapshot,
    showToast,
    ownerAdminEmail,
    user,
    setCashOpeningModalOpen,
    setCashOpeningInitialValues,
    openingSubmitInProgressRef,
    existingEntry,
  } = deps;

  if (accountKey !== "FondoGeneral") {
    setCashOpeningModalOpen(false);
    return;
  }

  const managerName = opening.manager.trim();
  if (!managerName) {
    showToast("Selecciona un encargado para poder guardar.", "warning", 4000);
    return;
  }

  if (openingSubmitInProgressRef.current) {
    showToast("Ya hay una apertura guardándose. Espere un momento.", "warning", 4000);
    return;
  }

  const totalCRC = Math.trunc(opening.totalCRC);
  const totalUSD = Math.trunc(opening.totalUSD);
  const diffCRC = totalCRC - Math.trunc(currentBalanceCRC);
  const diffUSD = totalUSD - Math.trunc(currentBalanceUSD);
  const hasDifferences = diffCRC !== 0 || diffUSD !== 0;

  openingSubmitInProgressRef.current = true;
  try {
    const createdAtISO = await getAuthoritativeNowISO();
    const createdAtDate = new Date(createdAtISO);
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) {
      showToast("Error: No se pudo identificar la empresa", "error");
      return;
    }

    const baseNotes = opening.notes.trim();
    const movementCreatedAt = existingEntry?.createdAt ?? createdAtISO;
    const movementInvoiceNumber =
      existingEntry?.invoiceNumber ?? dateKeyFromDate(createdAtDate);
    const commonFields = {
      providerCode: APERTURA_FONDO_PROVIDER_CODE,
      invoiceNumber: movementInvoiceNumber,
      manager: managerName,
      createdAt: movementCreatedAt,
      accountId: accountKey,
      openingBalanceCRC: totalCRC,
      openingBalanceUSD: totalUSD,
      openingPreviousBalanceCRC:
        existingEntry?.openingPreviousBalanceCRC ?? Math.trunc(currentBalanceCRC),
      openingPreviousBalanceUSD:
        existingEntry?.openingPreviousBalanceUSD ?? Math.trunc(currentBalanceUSD),
      openingBreakdownCRC: opening.breakdownCRC ?? {},
      openingBreakdownUSD: opening.breakdownUSD ?? {},
    } as const;

    const movementNotes = () => {
      const lines = [
        "APERTURA DE FONDO",
        hasDifferences
          ? `MOTIVO: AJUSTE APLICADO AL SALDO DE APERTURA\n[ALERT_ICON]Diferencia CRC: ${diffCRC >= 0 ? "+" : "-"} ${formatByCurrency("CRC", Math.abs(diffCRC))}\n[ALERT_ICON]Diferencia USD: ${diffUSD >= 0 ? "+" : "-"} ${formatByCurrency("USD", Math.abs(diffUSD))}`
          : `[CHECK_ICON]Sin diferencias.${baseNotes ? ` Notas: ${baseNotes}` : ""}`,
        `SALDO APERTURA CRC: ${formatByCurrency("CRC", totalCRC)}`,
        `SALDO APERTURA USD: ${formatByCurrency("USD", totalUSD)}`,
        `BILLETES CRC: ${Object.entries(opening.breakdownCRC ?? {})
          .filter(([, count]) => Number(count) > 0)
          .map(([denom, count]) => `${denom}x${count}`)
          .join(" · ") || "-"}`,
        `BILLETES USD: ${Object.entries(opening.breakdownUSD ?? {})
          .filter(([, count]) => Number(count) > 0)
          .map(([denom, count]) => `${denom}x${count}`)
          .join(" · ") || "-"}`,
      ];
      if (baseNotes && hasDifferences) lines.push(`NOTAS: ${baseNotes}`);
      return lines.filter(Boolean).join("\n");
    };

    const entryId = existingEntry?.id ?? `apertura-${Date.now()}`;
    let auditFields: Partial<FondoEntry> = {};
    if (existingEntry) {
      let history: any[] = [];
      try {
        const existing = existingEntry.auditDetails
          ? (JSON.parse(existingEntry.auditDetails) as any)
          : null;
        if (existing && Array.isArray(existing.history)) {
          history = existing.history.slice();
        } else if (existing && existing.before && existing.after) {
          history = [
            {
              at: existing.at ?? existingEntry.createdAt,
              before: existing.before,
              after: existing.after,
            },
          ];
        }
      } catch {
        history = [];
      }

      const nextPaymentType = hasDifferences
        ? (AUTO_ADJUSTMENT_OPENING_TYPE as any)
        : ("INFORMATIVO" as any);
      const changedFields = getChangedFields(
        {
          manager: existingEntry.manager,
          notes: existingEntry.notes,
          paymentType: existingEntry.paymentType,
          currency: existingEntry.currency,
        },
        {
          manager: managerName,
          notes: movementNotes(),
          paymentType: nextPaymentType,
          currency: "CRC",
        },
      );
      const addAuditField = (field: string, before: unknown, after: unknown) => {
        if (JSON.stringify(before) === JSON.stringify(after)) return;
        changedFields.before[field] = before;
        changedFields.after[field] = after;
      };
      addAuditField("openingBalanceCRC", existingEntry.openingBalanceCRC, totalCRC);
      addAuditField("openingBalanceUSD", existingEntry.openingBalanceUSD, totalUSD);
      addAuditField(
        "openingBreakdownCRC",
        existingEntry.openingBreakdownCRC,
        opening.breakdownCRC ?? {},
      );
      addAuditField(
        "openingBreakdownUSD",
        existingEntry.openingBreakdownUSD,
        opening.breakdownUSD ?? {},
      );

      history.push({ at: createdAtISO, ...changedFields });

      auditFields = {
        isAudit: true,
        originalEntryId: existingEntry.originalEntryId ?? existingEntry.id,
        auditDetails: JSON.stringify({ history: compressAuditHistory(history) }),
      };
    }

    const entry: FondoEntry = {
      ...(existingEntry ?? {}),
      ...commonFields,
      ...auditFields,
      id: entryId,
      paymentType: hasDifferences
        ? (AUTO_ADJUSTMENT_OPENING_TYPE as any)
        : ("INFORMATIVO" as any),
      amountEgreso: 0,
      amountIngreso: 0,
      notes: movementNotes(),
      currency: "CRC",
      breakdown: opening.breakdownCRC ?? {},
      updateAt: existingEntry ? createdAtISO : undefined,
    };

    const updatedEntries = existingEntry
      ? fondoEntries.map((item) => (item.id === existingEntry.id ? entry : item))
      : [entry, ...fondoEntries];

    const saved = await persistMovementToFirestore(
      updatedEntries,
      existingEntry ? "edit" : "create",
      {
        upsert: entry,
        before: existingEntry ?? undefined,
      },
    );
    if (!saved.ok) {
      showToast("Error al guardar la apertura. Por favor, intente de nuevo.", "error", 5000);
      return;
    }
    setFondoEntries((prev) =>
      existingEntry
        ? prev.map((item) => (item.id === existingEntry.id ? entry : item))
        : [entry, ...prev],
    );
    if (saved.ledgerSnapshot) {
      setLedgerSnapshot(saved.ledgerSnapshot as any);
    }

    try {
      const key = buildPhysicalCountStorageKey();
      if (key) localStorage.setItem(key, "false");
      cleanupPhysicalCountLegacyKeys();
    } catch {
      // ignore
    }

    if (hasDifferences) {
      const recipients = new Set<string>();
      const admin = ownerAdminEmail?.trim();
      if (admin) recipients.add(admin);
      const userEmail = user?.email?.trim();
      if (userEmail) recipients.add(userEmail);

      if (recipients.size > 0) {
        const subject = `[ALERTA][APERTURA] Ajuste de apertura (${normalizedCompany})`;
        const text = [
          `Empresa: ${normalizedCompany}`,
          `Caja: ${accountKey}`,
          `Fecha: ${createdAtISO}`,
          `Usuario: ${userEmail || "N/A"}`,
          `Saldo apertura CRC: ${formatByCurrency("CRC", totalCRC)}`,
          `Saldo apertura USD: ${formatByCurrency("USD", totalUSD)}`,
          `Diferencia CRC: ${diffCRC >= 0 ? "+" : "-"} ${formatByCurrency("CRC", Math.abs(diffCRC))}`,
          `Diferencia USD: ${diffUSD >= 0 ? "+" : "-"} ${formatByCurrency("USD", Math.abs(diffUSD))}`,
          `Motivo: AJUSTE APLICADO AL SALDO DE APERTURA`,
          baseNotes ? `Notas: ${baseNotes}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        await Promise.all(
          Array.from(recipients).map((to) =>
            addDoc(collection(db, "mail"), {
              to,
              subject,
              text,
              createdAt: serverTimestamp(),
            }),
          ),
        ).catch((mailErr) => {
          console.error("[APERTURA] Error enviando correo de ajuste:", mailErr);
        });
      }
    }

    setCashOpeningModalOpen(false);
    setCashOpeningInitialValues(null);
    showToast(
      existingEntry
        ? hasDifferences
          ? "Apertura de fondo actualizada con ajuste"
          : "Apertura de fondo actualizada correctamente"
        : hasDifferences
          ? "Apertura de fondo registrada con ajuste"
          : "Apertura de fondo registrada correctamente",
      "success",
      3000,
    );
  } catch (err) {
    console.error("[APERTURA] Error guardando apertura:", err);
    showToast("Error al guardar la apertura. Por favor, intente de nuevo.", "error", 5000);
  } finally {
    openingSubmitInProgressRef.current = false;
  }
}
