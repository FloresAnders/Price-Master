import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  getAuthoritativeNowISO,
  getAuthoritativeNowMs,
} from "@/utils/serverTime";
import { toCostaRicaISO } from "@/utils/costaRicaTime";
import { db } from "@/config/firebase";
import {
  DAILY_CLOSING_DUPLICATE_ERROR,
  DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR,
  DailyClosingsService,
  isValidDailyClosingSchedule,
  type DailyClosingRecord,
} from "@/services/daily-closings";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import type { Dispatch, SetStateAction } from "react";
import type { DailyClosingFormValues } from "../../components/modals/DailyClosingModal";
import type { FondoEntry } from "../../types";
import { buildDailyClosingEmailTemplate } from "@/services/email-templates/daily-closing";
import { reconcileClosing } from "@/domain/reconciliation";
import { exportDailyClosingSuperAdminImage } from "@/data/gereaImagenSuperAdmin/dailyClosingImage";
import {
  compressAuditHistory,
  formatByCurrency,
  getChangedFields,
  isAutoAdjustmentProvider,
} from "../helpers";
import { getCostaRicaOperationalDateKey } from "@/utils/controlHorarioManager";
import {
  AUTO_ADJUSTMENT_MANAGER,
  AUTO_ADJUSTMENT_PROVIDER_CODE,
} from "../../constants";
import { acquireClosingGuard, releaseClosingGuard, touchClosingGuard } from "./closingGuards";

type LedgerSnapshot = {
  initialCRC: number;
  currentCRC: number;
  initialUSD: number;
  currentUSD: number;
};

type GuardRef = { current: boolean };
type NumberRef = { current: number };
type StringSetRef = { current: Set<string> };

export interface HandleConfirmDailyClosingDeps {
  accountKey: string;
  activeOwnerId: string | null;
  beginDailyClosingsRequest: () => void;
  company: string | null | undefined;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  dailyClosingSubmitInProgressRef: GuardRef;
  dailyClosings: DailyClosingRecord[];
  dailyClosingsRequestCountRef: NumberRef;
  editingDailyClosingId: string | null;
  finishDailyClosingsRequest: () => void;
  fondoEntries: FondoEntry[];
  formatToastWaitTime: (remainingSec: number) => string;
  horarioApertura?: string | null;
  horarioCierre?: string | null;
  isRegularUser: boolean;
  lastDailyClosingSavedAtRef: NumberRef;
  minutesAfterClose?: number | null;
  requireSingleClosingReason: boolean;
  solicitarApertura: boolean;
  loadedDailyClosingKeysRef: StringSetRef;
  loadingDailyClosingKeysRef: StringSetRef;
  ownerAdminEmail: string | null;
  persistMovementToFirestore: (
    updatedEntries: FondoEntry[],
    operationType: "create" | "edit" | "delete",
    change:
      | {
          upsert?: FondoEntry;
          deleteId?: string;
          before?: FondoEntry | null;
        }
      | undefined,
  ) => Promise<{ ok: boolean; confirmed: boolean; ledgerSnapshot?: LedgerSnapshot }>;
  setDailyClosingInitialValues: (
    value: DailyClosingFormValues | null,
  ) => void;
  setDailyClosingModalOpen: (open: boolean) => void;
  setDailyClosings: Dispatch<SetStateAction<DailyClosingRecord[]>>;
  setDailyClosingsHydrated: (value: boolean) => void;
  setEditingDailyClosingId: (value: string | null) => void;
  setFondoEntries: Dispatch<SetStateAction<FondoEntry[]>>;
  setLedgerSnapshot: Dispatch<SetStateAction<LedgerSnapshot>>;
  setPendingCierreDeCaja: (value: boolean) => void;
  showToast: (message: string, kind?: "success" | "warning" | "error", durationMs?: number) => void;
  storageSnapshotRef: { current: any };
  user: { email?: string | null; id?: string | null; role?: string | null } | null;
}

const formatDailyClosingDiff = (currency: "CRC" | "USD", diff: number) => {
  if (diff === 0) return "Sin diferencias";
  const sign = diff > 0 ? "+" : "-";
  return `${sign} ${formatByCurrency(currency, Math.abs(diff))}`;
};

export async function handleConfirmDailyClosing(
  closing: DailyClosingFormValues,
  deps: HandleConfirmDailyClosingDeps,
) {
  const {
    accountKey,
    activeOwnerId,
    beginDailyClosingsRequest,
    company,
    currentBalanceCRC,
    currentBalanceUSD,
    dailyClosingSubmitInProgressRef,
    dailyClosings,
    dailyClosingsRequestCountRef,
    editingDailyClosingId,
    finishDailyClosingsRequest,
    fondoEntries,
    formatToastWaitTime,
    horarioApertura,
    horarioCierre,
    isRegularUser,
    lastDailyClosingSavedAtRef,
    minutesAfterClose,
    requireSingleClosingReason,
    solicitarApertura,
    loadedDailyClosingKeysRef,
    loadingDailyClosingKeysRef,
    ownerAdminEmail,
    persistMovementToFirestore,
    setDailyClosingInitialValues,
    setDailyClosingModalOpen,
    setDailyClosings,
    setDailyClosingsHydrated,
    setEditingDailyClosingId,
    setFondoEntries,
    setLedgerSnapshot,
    setPendingCierreDeCaja,
    showToast,
    storageSnapshotRef,
    user,
  } = deps;

  if (accountKey !== "FondoGeneral") {
    setDailyClosingModalOpen(false);
    return;
  }

  const managerName = closing.manager.trim();
  if (!managerName) {
    setDailyClosingModalOpen(false);
    return;
  }

  const dailyClosingSchedule = {
    horarioApertura,
    horarioCierre,
    minutesAfterClose,
  };
  if (!isValidDailyClosingSchedule(dailyClosingSchedule)) {
    showToast(DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR, "warning", 6000);
    return;
  }

  const createdAtISO = await getAuthoritativeNowISO();
  const createdAtCostaRicaISO = toCostaRicaISO(new Date(createdAtISO));
  const createdAtYear = createdAtCostaRicaISO.slice(0, 4);
  const createdAtMonth = createdAtCostaRicaISO.slice(5, 7);
  const createdAtDay = createdAtCostaRicaISO.slice(8, 10);
  const createdAtHour = createdAtCostaRicaISO.slice(11, 13);
  const createdAtMinute = createdAtCostaRicaISO.slice(14, 16);
  const createdAtSecond = createdAtCostaRicaISO.slice(17, 19);
  const createdAtMillisecond = createdAtCostaRicaISO.slice(20, 23);
  const invoiceDate = `${createdAtDay}-${createdAtMonth}-${createdAtYear}`;
  const cierreBaseId =
    `${createdAtYear}_${createdAtMonth}_${createdAtDay}-` +
    `${createdAtHour}_${createdAtMinute}_${createdAtSecond}_${createdAtMillisecond}_CIERRE`;
  const serverNowMs = await getAuthoritativeNowMs();

  let closingDateValue = closing.closingDate ? new Date(closing.closingDate) : new Date(createdAtISO);
  if (Number.isNaN(closingDateValue.getTime())) {
    closingDateValue = new Date(createdAtISO);
  }

  const createdAt = createdAtISO;
  const diffCRC = Math.trunc(closing.totalCRC) - Math.trunc(currentBalanceCRC);
  const diffUSD = Math.trunc(closing.totalUSD) - Math.trunc(currentBalanceUSD);
  const userNotes = closing.notes.trim();
  const singleClosingReason = String(closing.singleClosingReason || "").trim();
  const noMovements = Boolean(closing.noMovements);
  const noMovementsReason = String(closing.noMovementsReason || "").trim();
  const closingDateKey =
    getCostaRicaOperationalDateKey(
      closingDateValue.toISOString(),
      horarioApertura,
    ) ?? closingDateValue.toISOString().slice(0, 10);
  const sameDayClosings = dailyClosings.filter((item) =>
    item.id !== editingDailyClosingId &&
    (getCostaRicaOperationalDateKey(item.closingDate, horarioApertura) ?? item.closingDate.slice(0, 10)) === closingDateKey,
  );
  const previousDayClosing = sameDayClosings.find((item) => item.turno === "D");
  if (closing.turno === "N" && !previousDayClosing) {
    showToast("Debe existir cierre diurno antes del nocturno.", "warning", 5000);
    return;
  }
  let reconciliation;
  try {
    reconciliation = reconcileClosing({
      r08: closing.r08, t11: closing.t11,
      tucanCumulative: closing.tucanCumulative, tiemposCumulative: closing.tiemposCumulative,
      previous: previousDayClosing?.reconciliation,
      cumulativeR08: (previousDayClosing?.reconciliation?.calculated.cumulativeR08 ?? 0) + closing.r08,
      cumulativeT11: (previousDayClosing?.reconciliation?.calculated.cumulativeT11 ?? 0) + closing.t11,
      isFinalShift: closing.turno === "N",
    });
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Datos de conciliación inválidos.", "warning", 6000);
    return;
  }

  if (requireSingleClosingReason && !singleClosingReason) {
    showToast(
      "Debe indicar el motivo de por qué solo hubo un cierre en el día.",
      "warning",
      5000,
    );
    return;
  }
  if (noMovements && !noMovementsReason) {
    showToast(
      "Debe indicar el motivo de por qué no hubo movimientos.",
      "warning",
      5000,
    );
    return;
  }

  const record: DailyClosingRecord = {
    id: editingDailyClosingId ?? `${serverNowMs}`,
    createdAt: editingDailyClosingId
      ? (dailyClosings.find((d) => d.id === editingDailyClosingId)?.createdAt ?? createdAt)
      : createdAt,
    closingDate: closingDateValue.toISOString(),
    manager: managerName,
    totalCRC: Math.trunc(closing.totalCRC),
    totalUSD: Math.trunc(closing.totalUSD),
    recordedBalanceCRC: Math.trunc(currentBalanceCRC),
    recordedBalanceUSD: Math.trunc(currentBalanceUSD),
    diffCRC,
    diffUSD,
    notes: userNotes,
    ...(!editingDailyClosingId ||
    dailyClosings.find((d) => d.id === editingDailyClosingId)?.turno
      ? { turno: closing.turno }
      : {}),
    ...(singleClosingReason ? { singleClosingReason } : {}),
    ...(noMovements ? { noMovements: true, noMovementsReason } : {}),
    breakdownCRC: closing.breakdownCRC ?? {},
    breakdownUSD: closing.breakdownUSD ?? {},
    reconciliation,
  };

  const normalizedCompany = (company || "").trim();
  if (normalizedCompany.length === 0) {
    setDailyClosingModalOpen(false);
    showToast("Error: No se pudo identificar la empresa", "error");
    return;
  }

  let closingGuard: { token: string; docId: string } | null = null;
  try {
    const isEditingClosing = Boolean(editingDailyClosingId);
    if (!isEditingClosing && isRegularUser) {
      const acquired = await acquireClosingGuard(normalizedCompany, "FONDO_GENERAL", user, serverNowMs);
      if (!acquired.ok) {
        const kindLabel =
          acquired.lockedKind === "FONDO_GENERAL"
            ? "Fondo General"
            : acquired.lockedKind === "FONDO_VENTAS"
              ? "Fondo Ventas"
              : "otro cierre";
        showToast(
          `Otro cierre (${kindLabel}) se está registrando. Intente en ${formatToastWaitTime(
            acquired.remainingSec,
          )}.`,
          "warning",
          6000,
        );
        return;
      }
      closingGuard = { token: acquired.token, docId: acquired.docId };
    }
  } catch {
    // ignore; fall back to client-side cooldown
  }

  const isEditingClosing = Boolean(editingDailyClosingId);
  const dailyClosingCooldownKey = `fondogeneral-lastDailyClosingSavedAt:${normalizedCompany}`;
  if (!isEditingClosing) {
    if (dailyClosingSubmitInProgressRef.current || dailyClosingsRequestCountRef.current > 0) {
      showToast("Ya hay un cierre guardándose. Espere un momento.", "warning", 4000);
      return;
    }

    const nowMs = serverNowMs;
    let lastSavedAtMs = lastDailyClosingSavedAtRef.current;
    if (typeof window !== "undefined") {
      try {
        const stored = Number(localStorage.getItem(dailyClosingCooldownKey));
        if (Number.isFinite(stored) && stored > 0) {
          lastSavedAtMs = Math.max(lastSavedAtMs, stored);
        }
      } catch {
        // ignore storage errors
      }
    }

    if (isRegularUser) {
      if (lastSavedAtMs > 0 && nowMs - lastSavedAtMs < 60000) {
        const remainingMs = 60000 - (nowMs - lastSavedAtMs);
        const remainingSec = Math.ceil(remainingMs / 1000);
        showToast(
          `Ya se registró un cierre hace poco. Espere ${formatToastWaitTime(
            remainingSec,
          )} para crear otro.`,
          "warning",
          5000,
        );
        return;
      }
    }

    dailyClosingSubmitInProgressRef.current = true;
  }

  beginDailyClosingsRequest();
  try {
    await DailyClosingsService.saveClosing(
      normalizedCompany,
      record,
      dailyClosingSchedule,
    );
    console.log(
      `[CIERRE] ? Cierre guardado exitosamente en Firestore. ID: ${record.id}, Fecha: ${record.closingDate}`,
    );

    if (!isEditingClosing && !isRegularUser) {
      void touchClosingGuard(normalizedCompany, "FONDO_GENERAL", user, serverNowMs);
    }

    if (!isEditingClosing) {
      const savedAt = serverNowMs;
      lastDailyClosingSavedAtRef.current = savedAt;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(dailyClosingCooldownKey, String(savedAt));
        } catch {
          // ignore storage errors
        }
      }
    }

    setDailyClosings((prev) => {
      const next = prev.filter((item) => item.id !== record.id);
      return [...next, record];
    });
    loadedDailyClosingKeysRef.current.add(closingDateKey);
    loadingDailyClosingKeysRef.current.delete(closingDateKey);
    setDailyClosingsHydrated(true);

    setPendingCierreDeCaja(false);
    setDailyClosingModalOpen(false);
    if (user?.role === "superadmin") {
      void exportDailyClosingSuperAdminImage(normalizedCompany, record).catch((error) => {
        console.error("[CIERRE] Error exportando imagen SuperAdmin:", error);
        showToast("Cierre guardado, pero no se pudo exportar imagen.", "warning", 6000);
      });
    }
  } catch (err) {
    console.error("[CIERRE] ? Error guardando cierre en Firestore:", err);
    if (err instanceof Error && err.message.startsWith(DAILY_CLOSING_DUPLICATE_ERROR)) {
      showToast(err.message, "warning", 6000);
      if (closingGuard) {
        void releaseClosingGuard(normalizedCompany, closingGuard);
        closingGuard = null;
      }
      return;
    }
    if (err instanceof Error && err.message === DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR) {
      showToast(err.message, "warning", 6000);
      return;
    }

    const errorReason =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : (() => {
              try {
                return JSON.stringify(err);
              } catch {
                return String(err);
              }
            })();

    try {
    const whenISO = await getAuthoritativeNowISO().catch(
      () => "Hora del servidor no disponible",
    );
      const where = "FondoSection.handleConfirmDailyClosing -> DailyClosingsService.saveClosing";
      const errorMessage = err instanceof Error && err.stack
        ? `${errorReason}\n\nStack:\n${err.stack}`
        : errorReason;

      const subject = `[ALERTA][CIERRE] Error al guardar cierre (${normalizedCompany})`;
      const text = [
        `Dónde: ${where}`,
        `Cuándo: ${whenISO}`,
        `Empresa: ${normalizedCompany}`,
        `Usuario: ${(user?.email || "N/A").toString()}`,
        `Cierre ID: ${record.id}`,
        `Fecha cierre: ${record.closingDate}`,
        "",
        `Motivo exacto: ${errorMessage}`,
      ].join("\n");

      const recipients = ["chavesa698@gmail.com", "price.master.srl@gmail.com"];
      void Promise.all(
        recipients.map((to) =>
          addDoc(collection(db, "mail"), {
            to,
            subject,
            text,
            createdAt: serverTimestamp(),
          }),
        ),
      ).catch((mailErr) => {
        console.error("[CIERRE] ? Error encolando email de alerta:", mailErr);
      });
    } catch (mailErr) {
      console.error("[CIERRE] ? Error preparando email de alerta:", mailErr);
    }

    showToast(`Error al guardar el cierre: ${errorReason}`, "error", 10000);

    if (closingGuard) {
      try {
        void releaseClosingGuard(normalizedCompany, closingGuard);
      } catch {
        // ignore
      }
      closingGuard = null;
    }
    return;
  } finally {
    finishDailyClosingsRequest();
    if (!isEditingClosing) {
      dailyClosingSubmitInProgressRef.current = false;
    }
  }

  const notificationRecipients = new Set<string>();
  const adminRecipient = ownerAdminEmail?.trim();
  if (adminRecipient) {
    notificationRecipients.add(adminRecipient);
  } else if (activeOwnerId) {
    console.warn("Daily closing email: missing admin recipient for owner.", {
      ownerId: activeOwnerId,
      company: normalizedCompany,
    });
  }
  const userEmail = user?.email?.trim();
  if (userEmail) notificationRecipients.add(userEmail);

  const emailTemplate = buildDailyClosingEmailTemplate({
    company: normalizedCompany,
    accountKey,
    closingDateISO: record.closingDate,
    manager: record.manager,
    totalCRC: record.totalCRC,
    totalUSD: record.totalUSD,
    recordedBalanceCRC: record.recordedBalanceCRC,
    recordedBalanceUSD: record.recordedBalanceUSD,
    diffCRC: record.diffCRC,
    diffUSD: record.diffUSD,
    notes: record.notes,
    singleClosingReason: record.singleClosingReason,
    noMovements: record.noMovements,
    noMovementsReason: record.noMovementsReason,
    reconciliation: record.reconciliation,
  });

  if (notificationRecipients.size === 0 && activeOwnerId) {
    console.warn(
      "Daily closing email: skipped sending notification because no recipients were resolved.",
      {
        ownerId: activeOwnerId,
        company: normalizedCompany,
      },
    );
  }

  for (const recipient of notificationRecipients) {
    if (!recipient) continue;
    try {
      const docRef = await addDoc(collection(db, "mail"), {
        to: recipient,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
        createdAt: serverTimestamp(),
      });
      console.log(`[MAIL-DOC] Documento creado en 'mail' para ${recipient}, ID: ${docRef.id}`);
      showToast("Correo de cierre diario enviado correctamente", "success");
    } catch (err) {
      console.error(`[MAIL-DOC] Error creando documento en 'mail' para ${recipient}:`, err);
      showToast("Error al enviar correo de cierre diario", "error");
    }
  }

  try {
    const newMovements: FondoEntry[] = [];
    let latestLedgerSnapshot: LedgerSnapshot | null = null;

    const closingBalanceCRC = Math.trunc(record.totalCRC ?? 0);
    const closingBalanceUSD = Math.trunc(record.totalUSD ?? 0);

    let adjustedDiffCRC = record.diffCRC;
    let adjustedDiffUSD = record.diffUSD;
    if (editingDailyClosingId) {
      let prevCRCContribution = 0;
      let prevUSDContribution = 0;
      fondoEntries.forEach((e) => {
        if (e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode)) {
          const contrib = (e.amountIngreso || 0) - (e.amountEgreso || 0);
          if ((e.currency as any) === "USD") {
            prevUSDContribution += contrib;
          } else {
            prevCRCContribution += contrib;
          }
        }
      });

      const baseBalanceCRC = currentBalanceCRC - prevCRCContribution;
      const baseBalanceUSD = currentBalanceUSD - prevUSDContribution;
      adjustedDiffCRC = Math.trunc(closing.totalCRC) - Math.trunc(baseBalanceCRC);
      adjustedDiffUSD = Math.trunc(closing.totalUSD) - Math.trunc(baseBalanceUSD);
      record.diffCRC = adjustedDiffCRC;
      record.diffUSD = adjustedDiffUSD;
      try {
        record.recordedBalanceCRC = Math.trunc(baseBalanceCRC);
        record.recordedBalanceUSD = Math.trunc(baseBalanceUSD);
      } catch (rbErr) {
        console.error("[FG-DEBUG] Error setting recordedBalance on edited closing:", rbErr);
      }

      console.info("[FG-DEBUG] Editing closing values", {
        closingTotalCRC: closing.totalCRC,
        currentBalanceCRC,
        prevCRCContribution,
        baseBalanceCRC,
        adjustedDiffCRC,
      });
    }

    const willCreateInfo = adjustedDiffCRC === 0 && adjustedDiffUSD === 0;
    const willCreateCRC = !willCreateInfo && Boolean(adjustedDiffCRC);
    const willCreateUSD = !willCreateInfo && Boolean(adjustedDiffUSD);
    const plannedCount = Number(willCreateCRC) + Number(willCreateUSD) + Number(willCreateInfo);

    if (adjustedDiffCRC && adjustedDiffCRC !== 0) {
      const diff = Math.trunc(adjustedDiffCRC);
      const isPositive = diff > 0;
      const paymentType = "AJUSTE CIERRE" as any;
      const entry: FondoEntry = {
        id: cierreBaseId,
        providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
        invoiceNumber: invoiceDate,
        paymentType,
        amountEgreso: isPositive ? 0 : Math.abs(diff),
        amountIngreso: isPositive ? diff : 0,
        manager: AUTO_ADJUSTMENT_MANAGER,
        notes: `AJUSTE APLICADO AL SALDO ACTUAL\n[ALERT_ICON]Diferencia CRC: ${
          diff >= 0 ? "+ " : "- "
        }${formatByCurrency("CRC", Math.abs(diff))}.${userNotes ? ` Notas: ${userNotes}` : ""}`,
        createdAt,
        accountId: accountKey,
        currency: "CRC",
        breakdown: closing.breakdownCRC ?? {},
        closingBalanceCRC,
        closingBalanceUSD,
        requiresOpening: solicitarApertura,
      } as FondoEntry;
      newMovements.push(entry);
    }

    if (adjustedDiffUSD && adjustedDiffUSD !== 0) {
      const diff = Math.trunc(adjustedDiffUSD);
      const isPositive = diff > 0;
      const paymentType = "AJUSTE CIERRE" as any;
      const entry: FondoEntry = {
        id: plannedCount > 1 ? `${cierreBaseId}_USD` : cierreBaseId,
        providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
        invoiceNumber: invoiceDate,
        paymentType,
        amountEgreso: isPositive ? 0 : Math.abs(diff),
        amountIngreso: isPositive ? diff : 0,
        manager: AUTO_ADJUSTMENT_MANAGER,
        notes: `AJUSTE APLICADO AL SALDO ACTUAL\n[ALERT_ICON]Diferencia USD: ${
          diff >= 0 ? "+ " : "- "
        }${formatByCurrency("USD", Math.abs(diff))}.${userNotes ? ` Notas: ${userNotes}` : ""}`,
        createdAt,
        accountId: accountKey,
        currency: "USD",
        closingBalanceCRC,
        closingBalanceUSD,
        requiresOpening: solicitarApertura,
      } as FondoEntry;
      if ((entry as any).currency === "USD") (entry as any).breakdown = closing.breakdownUSD ?? {};
      newMovements.push(entry);
    }

    if (adjustedDiffCRC === 0 && adjustedDiffUSD === 0) {
      const entry: FondoEntry = {
        id: cierreBaseId,
        providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
        invoiceNumber: invoiceDate,
        paymentType: "INFORMATIVO" as any,
        amountEgreso: 0,
        amountIngreso: 0,
        manager: AUTO_ADJUSTMENT_MANAGER,
        notes: `[CHECK_ICON]Sin diferencias.${userNotes ? ` Notas: ${userNotes}` : ""}`,
        createdAt,
        accountId: accountKey,
        currency: "CRC",
        breakdown: closing.breakdownCRC ?? {},
        closingBalanceCRC,
        closingBalanceUSD,
        requiresOpening: solicitarApertura,
      } as FondoEntry;
      newMovements.push(entry);
    }

    if (editingDailyClosingId && newMovements.length === 0) {
      console.info("[FG-DEBUG] Removing previous adjustment movements for closing", record.id, {
        beforeCount: fondoEntries.length,
      });

      try {
        const toRemoveNow = fondoEntries.filter(
          (e) => e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode),
        );
        for (const removed of toRemoveNow) {
          const saved = await persistMovementToFirestore(fondoEntries, "delete", {
            deleteId: removed.id,
            before: removed,
          });
          if (saved.ok && saved.ledgerSnapshot) {
            latestLedgerSnapshot = saved.ledgerSnapshot;
          }
        }
      } catch (persistRemoveErr) {
        console.error(
          "[FG-DEBUG] Error persisting deletion of adjustment movements:",
          persistRemoveErr,
        );
      }

      setFondoEntries((prev) => {
        const toRemove = prev.filter(
          (e) => e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode),
        );
        const filtered = prev.filter(
          (e) => !(e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode)),
        );
        console.info("[FG-DEBUG] After remove, count:", filtered.length);
        if (toRemove.length > 0) {
          try {
            const resolution = {
              removedAdjustments: toRemove.map((r) => ({
                id: r.id,
                currency: r.currency,
                amount: (r.amountIngreso || 0) - (r.amountEgreso || 0),
                amountIngreso: r.amountIngreso || 0,
                amountEgreso: r.amountEgreso || 0,
                manager: r.manager,
                createdAt: r.createdAt,
              })),
              note: "Ajustes eliminados manualmente al editar el cierre",
            } as any;

            setDailyClosings((prevClosings) => {
              const updated = prevClosings.map((d) => {
                if (d.id !== record.id) return d;
                return {
                  ...d,
                  adjustmentResolution: resolution,
                } as DailyClosingRecord;
              });
              try {
                const updatedRecord = updated.find((d) => d.id === record.id);
                if (updatedRecord && normalizedCompany.length > 0) {
                  void DailyClosingsService.saveClosing(
                    normalizedCompany,
                    updatedRecord,
                    dailyClosingSchedule,
                  )
                    .then(() => {
                      console.log(
                        `[CIERRE] ? Ajuste de cierre guardado exitosamente. ID: ${updatedRecord.id}`,
                      );
                    })
                    .catch((saveErr) => {
                      console.error(
                        "[CIERRE] ? Error saving updated daily closing with resolution:",
                        saveErr,
                      );
                    });
                }
              } catch (saveErr) {
                console.error("[CIERRE] ? Error persisting daily closing resolution:", saveErr);
              }
              return updated;
            });
          } catch (err) {
            console.error("Error preparing adjustment resolution summary:", err);
          }
        }

        return filtered;
      });

      if (latestLedgerSnapshot) {
        setLedgerSnapshot(latestLedgerSnapshot);
      }
    }

    if (newMovements.length > 0) {
      newMovements.forEach((m) => (m.originalEntryId = record.id));

      try {
        const normalizeCurrency = (value: unknown) => (value === "USD" ? "USD" : "CRC");

        const plannedCurrencies = new Set(newMovements.map((m) => normalizeCurrency(m.currency)));

        const existingAdjustments = editingDailyClosingId
          ? fondoEntries.filter(
              (e) => e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode),
            )
          : [];

        const existingByCurrency = new Map<string, FondoEntry>();
        existingAdjustments.forEach((e) => {
          existingByCurrency.set(normalizeCurrency(e.currency), e);
        });

        if (editingDailyClosingId) {
          for (const prevAdj of existingAdjustments) {
            const cur = normalizeCurrency(prevAdj.currency);
            if (!plannedCurrencies.has(cur)) {
              const saved = await persistMovementToFirestore(fondoEntries, "delete", {
                deleteId: prevAdj.id,
                before: prevAdj,
              });
              if (saved.ok && saved.ledgerSnapshot) {
                latestLedgerSnapshot = saved.ledgerSnapshot;
              }
            }
          }
        }

        for (const movement of newMovements) {
          const cur = normalizeCurrency(movement.currency);
          const existing = existingByCurrency.get(cur);

          if (editingDailyClosingId && existing) {
            const updatedForPersist: FondoEntry = {
              ...existing,
              paymentType: movement.paymentType,
              invoiceNumber: movement.invoiceNumber,
              amountEgreso: movement.amountEgreso,
              amountIngreso: movement.amountIngreso,
              notes: movement.notes,
              breakdown: movement.breakdown ?? existing.breakdown,
              createdAt: movement.createdAt,
              manager: AUTO_ADJUSTMENT_MANAGER,
              providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
              accountId: accountKey,
              currency: cur,
              originalEntryId: record.id,
              closingBalanceCRC: movement.closingBalanceCRC,
              closingBalanceUSD: movement.closingBalanceUSD,
              requiresOpening: solicitarApertura,
            } as FondoEntry;

            const saved = await persistMovementToFirestore(fondoEntries, "edit", {
              upsert: updatedForPersist,
              before: existing,
            });
            if (saved.ok && saved.ledgerSnapshot) {
              latestLedgerSnapshot = saved.ledgerSnapshot;
            }
          } else {
            const saved = await persistMovementToFirestore([movement, ...fondoEntries], "create", {
              upsert: movement,
            });
            if (saved.ok && saved.ledgerSnapshot) {
              latestLedgerSnapshot = saved.ledgerSnapshot;
            }
          }
        }
      } catch (persistAdjErr) {
        console.error("[FG-DEBUG] Error persisting daily closing adjustments to main ledger:", persistAdjErr);
      }

      if (editingDailyClosingId) {
        setFondoEntries((prev) => {
          console.info(
            "[FG-DEBUG] Updating existing related adjustment movements for closing",
            record.id,
            { prevCount: prev.length, newMovements },
          );
          const updated = prev.map((e) => {
            if (e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode)) {
              const match = newMovements.find((nm) => nm.currency === e.currency);
              if (!match) return e;
              let history: any[] = [];
              try {
                const existing = e.auditDetails ? (JSON.parse(e.auditDetails) as any) : null;
                if (existing && Array.isArray(existing.history)) history = existing.history.slice();
                else if (existing && existing.before && existing.after) {
                  history = [
                    {
                      at: existing.at ?? e.createdAt,
                      before: existing.before,
                      after: existing.after,
                    },
                  ];
                }
              } catch {
                history = [];
              }
              const changedFields = getChangedFields(
                {
                  providerCode: e.providerCode,
                  invoiceNumber: e.invoiceNumber,
                  paymentType: e.paymentType,
                  amountEgreso: e.amountEgreso,
                  amountIngreso: e.amountIngreso,
                  manager: e.manager,
                  notes: e.notes,
                  currency: e.currency,
                },
                {
                  providerCode: e.providerCode,
                  invoiceNumber: match.invoiceNumber,
                  paymentType: match.paymentType,
                  amountEgreso: match.amountEgreso,
                  amountIngreso: match.amountIngreso,
                  manager: AUTO_ADJUSTMENT_MANAGER,
                  notes: match.notes,
                  currency: match.currency,
                },
              );
              const newRecord = { at: createdAt, ...changedFields };
              history.push(newRecord);
              const compressedHistory = compressAuditHistory(history);
              return {
                ...e,
                paymentType: match.paymentType,
                amountEgreso: match.amountEgreso,
                amountIngreso: match.amountIngreso,
                breakdown: match.breakdown ?? e.breakdown,
                notes: match.notes,
                createdAt: match.createdAt,
                manager: AUTO_ADJUSTMENT_MANAGER,
                closingBalanceCRC: match.closingBalanceCRC,
                closingBalanceUSD: match.closingBalanceUSD,
                requiresOpening: match.requiresOpening,
                isAudit: true,
                originalEntryId: e.originalEntryId ?? e.id,
                auditDetails: JSON.stringify({ history: compressedHistory }),
              } as FondoEntry;
            }
            return e;
          });
          newMovements.forEach((nm) => {
            const exists = updated.some(
              (u) => u.originalEntryId === record.id && u.currency === nm.currency && isAutoAdjustmentProvider(u.providerCode),
            );
            if (!exists) {
              updated.unshift(nm);
            }
          });
          console.info("[FG-DEBUG] Updated fondoEntries count after merge:", updated.length);
          return updated;
        });
      } else {
        console.info("[FG-DEBUG] Prepending new adjustment movements", newMovements);
        setFondoEntries((prev) => {
          const next = [...newMovements, ...prev];
          console.info("[FG-DEBUG] fondoEntries count after prepend:", next.length);
          return next;
        });
      }

      if (latestLedgerSnapshot) {
        setLedgerSnapshot(latestLedgerSnapshot);
      }

      try {
        const addedParts: string[] = newMovements.map((m) => {
          const amt = (m.amountIngreso || 0) - (m.amountEgreso || 0);
          const sign = amt >= 0 ? "+" : "-";
          return `${m.currency} ${sign} ${formatByCurrency(m.currency as "CRC" | "USD", Math.abs(amt))}`;
        });
        const note = `Ajustes aplicados: ${addedParts.join(" / ")}`;

        const totalNewCRC = newMovements.reduce(
          (s, m) => s + (m.currency === "CRC" ? (m.amountIngreso || 0) - (m.amountEgreso || 0) : 0),
          0,
        );
        const totalNewUSD = newMovements.reduce(
          (s, m) => s + (m.currency === "USD" ? (m.amountIngreso || 0) - (m.amountEgreso || 0) : 0),
          0,
        );

        const prevCRCContributionExisting = fondoEntries.reduce(
          (s, e) =>
            s +
            (e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode) && e.currency === "CRC"
              ? (e.amountIngreso || 0) - (e.amountEgreso || 0)
              : 0),
          0,
        );
        const prevUSDContributionExisting = fondoEntries.reduce(
          (s, e) =>
            s +
            (e.originalEntryId === record.id && isAutoAdjustmentProvider(e.providerCode) && e.currency === "USD"
              ? (e.amountIngreso || 0) - (e.amountEgreso || 0)
              : 0),
          0,
        );

        const postAdjustmentBalanceCRC = Math.trunc(
          currentBalanceCRC - prevCRCContributionExisting + totalNewCRC,
        );
        const postAdjustmentBalanceUSD = Math.trunc(
          currentBalanceUSD - prevUSDContributionExisting + totalNewUSD,
        );
        const hasCRCAdjustments = totalNewCRC !== 0 || prevCRCContributionExisting !== 0;
        const hasUSDAdjustments = totalNewUSD !== 0 || prevUSDContributionExisting !== 0;

        setDailyClosings((prevClosings) => {
          const updated = prevClosings.map((d) => {
            if (d.id !== record.id) return d;
            const existingResolution = d.adjustmentResolution || {};
            const updatedResolution: DailyClosingRecord["adjustmentResolution"] = {
              ...(existingResolution.removedAdjustments
                ? { removedAdjustments: existingResolution.removedAdjustments }
                : {}),
              note,
              ...(hasCRCAdjustments ? { postAdjustmentBalanceCRC } : {}),
              ...(hasUSDAdjustments ? { postAdjustmentBalanceUSD } : {}),
            };
            return {
              ...d,
              adjustmentResolution: updatedResolution,
            } as DailyClosingRecord;
          });

          try {
            const updatedRecord = updated.find((d) => d.id === record.id);
            if (updatedRecord && normalizedCompany.length > 0) {
              void DailyClosingsService.saveClosing(
                normalizedCompany,
                updatedRecord,
                dailyClosingSchedule,
              )
                .then(() => {
                  console.log(`[CIERRE] ? Nota de ajuste guardada exitosamente. ID: ${updatedRecord.id}`);
                })
                .catch((saveErr) => {
                  console.error("[CIERRE] ? Error saving daily closing with adjustment note:", saveErr);
                });
            }
          } catch (saveErr) {
            console.error("[CIERRE] ? Error persisting daily closing adjustment note:", saveErr);
          }

          return updated;
        });
      } catch (noteErr) {
        console.error("Error building/persisting adjustment note:", noteErr);
      }
    }
  } catch (err) {
    console.error("Error creating movement(s) for daily closing difference:", err);
  }

  try {
    const crcDiff = record.diffCRC ?? 0;
    const usdDiff = record.diffUSD ?? 0;
    if (crcDiff === 0 && usdDiff === 0) {
      try {
        showToast("Cierre completo, sin diferencias", "success", 4000);
      } catch {
        // swallow toast errors to avoid breaking flow
      }
    } else {
      try {
        const parts: string[] = [];
        if (crcDiff !== 0) parts.push(`CRC ${formatDailyClosingDiff("CRC", crcDiff)}`);
        if (usdDiff !== 0) parts.push(`USD ${formatDailyClosingDiff("USD", usdDiff)}`);
        const message = `Cierre con diferencias: ${parts.join(" / ")}`;
        showToast(message, "warning", 6000);
      } catch {
        // swallow toast errors
      }
    }
  } catch {
    // defensive: ignore
  }

  if (!editingDailyClosingId && storageSnapshotRef.current) {
    const normalizedCompanyForLock = (company || "").trim();
    if (!storageSnapshotRef.current.state) {
      storageSnapshotRef.current.state =
        MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(normalizedCompanyForLock).state;
    }
    storageSnapshotRef.current.state.lockedUntil = createdAt;

    if (normalizedCompanyForLock.length > 0) {
      const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompanyForLock);
      try {
        localStorage.setItem(companyKey, JSON.stringify(storageSnapshotRef.current));
        void MovimientosFondosService.saveDocument(companyKey, storageSnapshotRef.current)
          .then(() => console.log("[LOCK-DEBUG] Force saved to Firestore after closing"))
          .catch((err) => {
            console.error("Error force saving lockedUntil to Firestore:", err);
          });
      } catch (err) {
        console.error("Error force persisting lockedUntil:", err);
      }
    }
  }

  setEditingDailyClosingId(null);
  setDailyClosingInitialValues(null);
}
