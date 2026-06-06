import type { Dispatch, SetStateAction } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { getAuthoritativeNowISO } from "@/utils/serverTime";
import { dateKeyFromDate, formatByCurrency } from "./helpers";
import { APERTURA_FONDO_PROVIDER_CODE, AUTO_ADJUSTMENT_OPENING_TYPE } from "../constants";
import type { FondoEntry } from "../types";
import type { CashOpeningFormValues } from "../components/CashOpeningModal";

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

    const baseNotes = opening.notes.trim().toUpperCase();
    const commonFields = {
      providerCode: APERTURA_FONDO_PROVIDER_CODE,
      invoiceNumber: dateKeyFromDate(createdAtDate),
      manager: managerName,
      createdAt: createdAtISO,
      accountId: accountKey,
      openingBalanceCRC: totalCRC,
      openingBalanceUSD: totalUSD,
      openingPreviousBalanceCRC: Math.trunc(currentBalanceCRC),
      openingPreviousBalanceUSD: Math.trunc(currentBalanceUSD),
      openingBreakdownCRC: opening.breakdownCRC ?? {},
      openingBreakdownUSD: opening.breakdownUSD ?? {},
    } as const;

    const movementNotes = () => {
      const lines = [
        "APERTURA DE FONDO",
        hasDifferences
          ? `MOTIVO: AJUSTE APLICADO AL SALDO DE APERTURA\n[ALERT_ICON]Diferencia CRC: ${diffCRC >= 0 ? "+" : "-"} ${formatByCurrency("CRC", Math.abs(diffCRC))}\n[ALERT_ICON]Diferencia USD: ${diffUSD >= 0 ? "+" : "-"} ${formatByCurrency("USD", Math.abs(diffUSD))}`
          : "SIN DIFERENCIAS",
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
      if (baseNotes) lines.push(`NOTAS: ${baseNotes}`);
      return lines.filter(Boolean).join("\n");
    };

    const entry: FondoEntry = {
      ...commonFields,
      id: `apertura-${Date.now()}`,
      paymentType: hasDifferences ? (AUTO_ADJUSTMENT_OPENING_TYPE as any) : ("INFORMATIVO" as any),
      amountEgreso: 0,
      amountIngreso: 0,
      notes: movementNotes(),
      currency: "CRC",
      breakdown: opening.breakdownCRC ?? {},
    };

    const saved = await persistMovementToFirestore([entry, ...fondoEntries], "create", {
      upsert: entry,
    });
    if (!saved.ok) {
      showToast("Error al guardar la apertura. Por favor, intente de nuevo.", "error", 5000);
      return;
    }
    setFondoEntries((prev) => [entry, ...prev]);
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
      hasDifferences
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
