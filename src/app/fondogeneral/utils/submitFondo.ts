import { db } from "@/config/firebase";
import { resolveManagerFromControlHorario } from "@/utils/controlHorarioManager";
import {
  FacturasService,
  type AppliedCreditNote,
  type FacturaMovement,
} from "../../../services/facturas";
import { findLatestMovementByInvoiceNumber, sendDuplicateInvoiceAlertEmail } from "../../../services/duplicate-invoice-alert";
import { MovimientosFondosService, type MovementCurrencyKey } from "../../../services/movimientos-fondos";
import { ProvidersService } from "../../../services/providers";
import {
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
  CACHE_TTL_MS,
  MAX_AUDIT_EDITS,
  MOVEMENT_COOLDOWN_MS,
} from "../constants";
import {
  acquireClosingGuard,
  releaseClosingGuard,
  touchClosingGuard,
} from "../utils/closingGuards";
import { sendMovementNotification } from "../utils/notifications";
import { buildV2MovementsCacheKey } from "../utils/v2movements";
import type { FondoEntry } from "../types";
import {
  compressAuditHistory,
  formatToastWaitTime,
  getChangedFields,
  getEffectiveLastCreatedAtMs,
  isIngresoDesdeFondoVentasMovement,
  isInventoryPurchasePaymentType,
  isInventoryPurchaseProviderType,
  isEgresoType,
  isPaidFcrMovement,
  normalizeInvoiceDocType,
  parseLastCreatedCooldown,
  resolveEffectiveEgresoAmount,
  roundCreditNotePaymentAmount,
  stripUndefinedDeep,
} from "../utils/helpers";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getAuthoritativeNowISO } from "@/utils/serverTime";

export interface SubmitFondoDeps {
  [key: string]: any;
}

export async function handleSubmitFondo(deps: SubmitFondoDeps) {
  const {
    company,
    isSaving,
    movementSubmitInProgressRef,
    manager,
    isCajaNegra,
    editingEntryId,
    getTodayInvoiceMMDD,
    invoiceNumber,
    invoiceDocType,
    selectedProvider,
    setProviderError,
    selectedProviderExists,
    editingEntry,
    setInvoiceError,
    isRegularUser,
    accountKey,
    namespace,
    isDelifoodCompany,
    activeEmpresaForCompany,
    getFGMonthlySchedulesCached,
    setMissingShiftExpectedShift,
    setMissingShiftDateKey,
    setMissingShiftModalOpen,
    setManager,
    setManagerError,
    manager2,
    isEditingPaidFcrMovement,
    setManager2Error,
    isEgreso,
    isIngreso,
    egreso,
    ingreso,
    notes,
    movementProviders,
    paymentType,
    setAmountError,
    showToast,
    selectedAppliedCreditNoteIds,
    selectedProviderPendingCreditNotes,
    setPendingZeroAmountCreditNoteModalOpen,
    isAdminUser,
    isSuperAdminUser,
    ledgerSnapshot,
    fondoEntries,
    initialAmount,
    lastMovementCreatedAtRef,
    lastMovementDedupeRef,
    lastEditSaveTimestampRef,
    setIsSaving,
    editingInProgressRef,
    persistMovementToFirestore,
    persistCreatedMovement,
    setFondoEntries,
    setLedgerSnapshot,
    movementAutoCloseLocked,
    resetFondoForm,
    setMovementModalOpen,
    ownerAdminEmail,
    activeOwnerId,
    user,
    manualCreditNoteDraft,
    setSelectedProviderPendingCreditNotes,
    setSelectedAppliedCreditNoteIds,
    pendingClosingCreditInvoices,
    selectedPendingCreditInvoiceIds,
    setPendingClosingCreditInvoices,
    selectedProviderPendingCreditInvoices,
    setSelectedPendingCreditInvoiceIds,
    v2MovementsCacheRef,
    rebuildEntriesFromV2Cache,
    applyLedgerStateFromStorage,
    storageSnapshotRef,
    setNegativeBalanceModal,
    providers,
    movementCurrency,
  } = deps;

  if (!company) return;
  if (isSaving || movementSubmitInProgressRef.current) return; // Prevenir múltiples envíos

  let hasErrors = false;
  let nowISO: string;
  try {
    nowISO = await getAuthoritativeNowISO();
  } catch (err) {
    console.error("[FG] No se pudo validar la hora del servidor:", err);
    setProviderError("No se pudo validar la hora del servidor. Revisa conexión e intenta de nuevo.");
    showToast?.("No se pudo validar la hora del servidor. Movimiento bloqueado.", "error");
    return;
  }
  const serverNowMs = new Date(nowISO).getTime();
  let effectiveManager = manager;

  const effectiveInvoiceNumber =
    isCajaNegra && !editingEntryId ? getTodayInvoiceMMDD() : invoiceNumber;

  if (!selectedProvider) {
    setProviderError("Selecciona un proveedor");
    hasErrors = true;
  } else {
    setProviderError("");
  }

  const providerExists = selectedProviderExists;
  if (
    !providerExists &&
    !(editingEntryId && editingEntry?.providerCode === selectedProvider)
  ) {
    setProviderError("Proveedor no válido");
    hasErrors = true;
  }

  if (!/^[0-9]{1,4}$/.test(effectiveInvoiceNumber)) {
    setInvoiceError("Ingresa un número de factura válido (1-4 dígitos)");
    hasErrors = true;
  } else {
    setInvoiceError("");
  }

  const shouldAutoManagerFromControlHorario =
    isRegularUser &&
    accountKey === "FondoGeneral" &&
    namespace === "fg" &&
    !editingEntryId &&
    !isDelifoodCompany;

  if (shouldAutoManagerFromControlHorario) {
    try {
      const empresa = activeEmpresaForCompany;
      if (empresa) {
        const normalizedCompany = (company || "").trim();
        const companyKeysToTry = (() => {
          const set = new Set<string>();
          if (normalizedCompany) set.add(normalizedCompany);
          [empresa?.name, empresa?.ubicacion, empresa?.id]
            .map((v) =>
              typeof v === "string" ? v.trim() : String(v || "").trim(),
            )
            .filter(Boolean)
            .forEach((v) => set.add(v));
          return Array.from(set);
        })();

        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Costa_Rica",
          year: "numeric",
          month: "2-digit",
        }).formatToParts(new Date(nowISO));
        const year = Number(parts.find((p) => p.type === "year")?.value);
        const month1 = Number(parts.find((p) => p.type === "month")?.value);
        const month0 = Math.max(0, Math.min(11, month1 - 1));

        if (Number.isFinite(year) && Number.isFinite(month1)) {
        const schedulesLists = await Promise.all(
            companyKeysToTry.map((key: string) =>
              getFGMonthlySchedulesCached(key, year, month0),
            ),
          );
          const monthSchedules = schedulesLists.flat();
          const resolution = resolveManagerFromControlHorario({
            nowISO,
            empresa,
            monthSchedules,
            closingMovements: fondoEntries as Array<{
              createdAt?: string;
              providerCode?: string;
            }>,
            providers: movementProviders as Array<{
              code: string;
              name?: string | null;
            }>,
          });

          if (resolution.mode === "missing") {
            setMissingShiftExpectedShift(resolution.expectedShift);
            setMissingShiftDateKey(resolution.dateKey);
            setMissingShiftModalOpen(true);
            return;
          }

          if (resolution.mode === "auto") {
            effectiveManager = resolution.manager;
            setManager(resolution.manager);
            setManagerError("");
          }
        }
      }
    } catch (err) {
      console.error("[FG] Error resolving manager from control horario:", err);
    }
  }

  if (isEditingPaidFcrMovement) {
    setManagerError("");
    setManager2Error("");
  } else if (!effectiveManager) {
    setManagerError("Selecciona un encargado");
    hasErrors = true;
  } else {
    setManagerError("");
    setManager2Error("");
  }
  const egresoValue = isEgreso ? Number.parseInt(egreso, 10) : 0;
  const ingresoValue = isIngreso ? Number.parseInt(ingreso, 10) : 0;
  const trimmedNotes = notes.trim();
  const movementSelectedProviderData = movementProviders.find(
      (p: any) => p.code === selectedProvider,
  );
  const shouldMirrorMovementToFacturas = !isCajaNegra && isInventoryPurchaseProviderType(
    movementSelectedProviderData?.type,
  );

  if (isEgreso && (Number.isNaN(egresoValue) || egresoValue <= 0)) {
    setAmountError("Ingresa un monto válido para egreso");
    hasErrors = true;
  } else if (isIngreso && (Number.isNaN(ingresoValue) || ingresoValue <= 0)) {
    setAmountError("Ingresa un monto válido para ingreso");
    hasErrors = true;
  } else {
    setAmountError("");
  }

  if (hasErrors) return;

  const selectedZeroAmountNC = selectedAppliedCreditNoteIds.some((id: string) =>
    selectedProviderPendingCreditNotes.some(
      (note: any) => note.id === id && note.amount === 0,
    ),
  );
  if (selectedZeroAmountNC) {
    setPendingZeroAmountCreditNoteModalOpen(true);
    return;
  }

  if (isEgreso && (Number.isNaN(egresoValue) || egresoValue <= 0)) return;
  if (isIngreso && (Number.isNaN(ingresoValue) || ingresoValue <= 0)) return;

  const effectiveInvoiceDocType = normalizeInvoiceDocType(invoiceDocType) as "FCO" | "FCR";
  if (!editingEntryId && effectiveInvoiceDocType === "FCR") {
    setInvoiceError(
      "Las facturas a crédito se crean desde Facturas de crédito y notas de crédito.",
    );
    return;
  }

  if (effectiveInvoiceDocType === "FCR" && !shouldMirrorMovementToFacturas) {
    setInvoiceError(
      'Solo los proveedores de tipo "COMPRA INVENTARIO" pueden generar facturas.',
    );
    return;
  }

  const buildAppliedCreditNotes = (
    invoiceAmount: number,
  ): { notes: AppliedCreditNote[]; total: number; amountPayment: number } => {
    if (!isEgreso || editingEntryId || effectiveInvoiceDocType !== "FCO") {
      return { notes: [], total: 0, amountPayment: invoiceAmount };
    }

    const selectedIds = new Set(selectedAppliedCreditNoteIds);
    let remaining = Math.max(0, Math.trunc(invoiceAmount));
    let total = 0;
    const notes: AppliedCreditNote[] = [];

    selectedProviderPendingCreditNotes.forEach((note: any) => {
      if (remaining <= 0 || !selectedIds.has(note.id)) return;
      if (note.currency !== movementCurrency) return;
      const appliedAmount = Math.min(
        remaining,
        Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
      );
      if (appliedAmount <= 0) return;
      total += appliedAmount;
      remaining -= appliedAmount;
      notes.push({
        id: note.id,
        invoiceNumber: note.invoiceNumber,
        amount: note.amount,
        appliedAmount,
        currency: note.currency,
      });
    });

    return {
      notes,
      total,
      amountPayment: roundCreditNotePaymentAmount(
        Math.max(0, Math.trunc(invoiceAmount) - total),
        movementCurrency,
        accountKey,
      ),
    };
  };
  const selectedCreditNotesRequestedTotal =
    isEgreso && effectiveInvoiceDocType === "FCO"
    ? selectedProviderPendingCreditNotes.reduce((sum: number, note: any) => {
          if (!selectedAppliedCreditNoteIds.includes(note.id)) return sum;
          if (note.currency !== movementCurrency) return sum;
          return sum + Math.max(0, Math.trunc(note.balanceDue));
        }, 0)
      : 0;
  if (
    isEgreso &&
    effectiveInvoiceDocType === "FCO" &&
    selectedCreditNotesRequestedTotal > egresoValue
  ) {
    showToast(
      "Las notas de credito seleccionadas superan el saldo disponible. Desmarca alguna para continuar.",
      "error",
      5000,
    );
    return;
  }
  const creditNoteApplication = buildAppliedCreditNotes(egresoValue);
  const manualCreditNoteAppliedAmount =
    isEgreso && effectiveInvoiceDocType === "FCO" && manualCreditNoteDraft
      ? Math.min(
          manualCreditNoteDraft.amount,
          Math.max(0, egresoValue - creditNoteApplication.total),
        )
      : 0;
  const totalCreditNotesAppliedAmount =
    creditNoteApplication.total + manualCreditNoteAppliedAmount;
  const roundedInvoicePaymentAmount = roundCreditNotePaymentAmount(
    Math.max(0, egresoValue - totalCreditNotesAppliedAmount),
    movementCurrency,
    accountKey,
  );
  const selectedCreditInvoiceIdSet = new Set(selectedPendingCreditInvoiceIds);
  const selectedCreditInvoicesTotal = isEgreso
    ? selectedProviderPendingCreditInvoices.reduce((sum: number, invoice: any) => {
        if (!selectedCreditInvoiceIdSet.has(invoice.id)) return sum;
        if (invoice.currency !== movementCurrency) return sum;
        return sum + Math.max(0, Math.trunc(invoice.balanceDue));
      }, 0)
    : 0;
  const egresoBalanceImpact =
    isEgreso && effectiveInvoiceDocType === "FCO"
      ? roundedInvoicePaymentAmount + selectedCreditInvoicesTotal
      : egresoValue;

  // Validar que no quede saldo negativo en la moneda del movimiento.
  // Nota: este límite de "saldo insuficiente" solo aplica para usuarios regulares.
  // Admin/Superadmin pueden registrar egresos que dejen saldo negativo.
  // En edición se revierte primero el impacto del movimiento original.
  if (
    isEgreso &&
    effectiveInvoiceDocType !== "FCR" &&
    !isAdminUser &&
    !isSuperAdminUser
  ) {
    const currentBalance =
      movementCurrency === "USD"
        ? ledgerSnapshot.currentUSD
        : ledgerSnapshot.currentCRC;

    let effectiveBalance = currentBalance;
    if (editingEntryId) {
    const originalEntry = fondoEntries.find((e: FondoEntry) => e.id === editingEntryId);
      if (originalEntry) {
        const originalCurrency: MovementCurrencyKey =
          originalEntry.currency === "USD" ? "USD" : "CRC";
        if (originalCurrency === movementCurrency) {
          effectiveBalance += resolveEffectiveEgresoAmount(originalEntry);
          effectiveBalance -= Math.trunc(
            Number(originalEntry.amountIngreso) || 0,
          );
        }
      }
    }
    const resultingBalance = effectiveBalance - egresoBalanceImpact;
    console.log(
      `Validando saldo negativo: effectiveBalance=${effectiveBalance}, egresoValue=${egresoBalanceImpact}, resultingBalance=${resultingBalance}`,
    );

    if (resultingBalance < 0) {
      setNegativeBalanceModal({
        open: true,
        amount: egresoBalanceImpact,
        currency: movementCurrency,
        resultingNegativeAmount: resultingBalance,
      });
      return;
    }
  }

  const paddedInvoice = effectiveInvoiceNumber.padStart(4, "0");

  // Dedupe window only for NEW movements (edits remain allowed)
  if (!editingEntryId) {
    try {
      const normalizedCompany = (company || "").trim();
      if (normalizedCompany.length > 0) {
        // Enforce minimum interval between ANY new movements
        const nowMs = Date.now();
        const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${accountKey}`;
        let lastCreatedAtMs = lastMovementCreatedAtRef.current;
        if (typeof window !== "undefined") {
          try {
            const payload = parseLastCreatedCooldown(
              localStorage.getItem(createdKey),
            );
            const effectiveAt = getEffectiveLastCreatedAtMs(payload);
            if (effectiveAt > 0) {
              lastCreatedAtMs = Math.max(lastCreatedAtMs, effectiveAt);
            }
          } catch {
            // ignore
          }
        }

        // Admins/Superadmins are exempt from the 1-minute cooldown.
        // Additionally, if the NEW movement is "INGRESO DESDE FONDO VENTAS",
        // it should NOT be blocked by a prior movement's cooldown.
      const providerForSelected = movementProviders.find(
          (p: any) => p.code === selectedProvider,
        );
        const providerDisplayForSelected =
          providerForSelected?.name || selectedProvider;
        const newIsIngresoDesdeFV = isIngresoDesdeFondoVentasMovement(
          {
            providerCode: selectedProvider,
            paymentType,
            notes: trimmedNotes,
          },
          providerDisplayForSelected,
        );

        if (!newIsIngresoDesdeFV) {
          if (
            !isAdminUser &&
            !isSuperAdminUser &&
            !isCajaNegra &&
            lastCreatedAtMs > 0 &&
            nowMs - lastCreatedAtMs < MOVEMENT_COOLDOWN_MS
          ) {
            const remainingMs = MOVEMENT_COOLDOWN_MS - (nowMs - lastCreatedAtMs);
            const remainingSec = Math.ceil(remainingMs / 1000);
            showToast(
              `Espere ${formatToastWaitTime(remainingSec)} para agregar otro movimiento.`,
              "warning",
              5000,
            );
            return;
          }
        }

        const fingerprintParts = [
          `provider=${selectedProvider || ""}`,
          `invoice=${paddedInvoice || ""}`,
          `invoiceDocType=${normalizeInvoiceDocType(invoiceDocType)}`,
          `type=${paymentType || ""}`,
          `egreso=${Math.trunc(isEgreso ? egresoValue : 0)}`,
          `payment=${Math.trunc(
            isEgreso && effectiveInvoiceDocType === "FCO"
              ? creditNoteApplication.amountPayment
              : 0,
          )}`,
          `creditInvoices=${Math.trunc(selectedCreditInvoicesTotal)}`,
          `ingreso=${Math.trunc(isIngreso ? ingresoValue : 0)}`,
          `manager=${(manager || "").trim()}`,
          `currency=${movementCurrency || "CRC"}`,
          `notes=${trimmedNotes}`,
        ];
        const fingerprint = fingerprintParts.join("|");
        const key = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${accountKey}`;

        let last = lastMovementDedupeRef.current;
        if (!last && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw) as any;
              if (
                parsed &&
                typeof parsed.at === "number" &&
                typeof parsed.fingerprint === "string"
              ) {
                last = { at: parsed.at, fingerprint: parsed.fingerprint };
              }
            }
          } catch {
            // ignore
          }
        }

        if (
          last &&
          last.fingerprint === fingerprint &&
          nowMs - last.at < CACHE_TTL_MS &&
          !isCajaNegra
        ) {
          const remainingMs = CACHE_TTL_MS - (nowMs - last.at);
          const remainingSec = Math.ceil(remainingMs / 1000);
          showToast(
            `Movimiento duplicado detectado. Espere ${formatToastWaitTime(
              remainingSec,
            )} para volver a guardarlo.`,
            "warning",
            5000,
          );
          return;
        }

        // lock immediately to avoid double-click duplicates before state updates
        movementSubmitInProgressRef.current = true;
      }
    } catch {
      // If dedupe fails for any reason, still lock to prevent double-submit
      movementSubmitInProgressRef.current = true;
    }
  }

  setIsSaving(true);

  try {
    if (editingEntryId) {
      // Update the existing entry in-place so balances remain correct.
      const original = fondoEntries.find((e: FondoEntry) => e.id === editingEntryId);
      if (!original) {
        setIsSaving(false);
        return;
      }

      const isEditingPaidFcr = isPaidFcrMovement(original);
      const originalManager2 = String(original.manager2 || "").trim();
      const effectiveManager = isEditingPaidFcr ? original.manager : manager;
      const effectiveManager2 = isEditingPaidFcr
        ? originalManager2
        : originalManager2;
      const effectiveProvider = isEditingPaidFcr
        ? original.providerCode
        : selectedProvider;
      const effectiveInvoiceNumber = isEditingPaidFcr
        ? original.invoiceNumber
        : paddedInvoice;
      const effectiveInvoiceDocType = isEditingPaidFcr
        ? normalizeInvoiceDocType((original as any).invoiceDocType)
        : normalizeInvoiceDocType(invoiceDocType);
      const effectivePaymentType = isEditingPaidFcr
        ? original.paymentType
        : paymentType;
      const effectiveCurrency = isEditingPaidFcr
        ? ((original.currency === "USD" ? "USD" : "CRC") as MovementCurrencyKey)
        : movementCurrency;
      const effectiveIsEgreso = isEditingPaidFcr
        ? isEgresoType(original.paymentType) || original.amountEgreso > 0
        : isEgreso;

      const changes: string[] = [];
      if (!isEditingPaidFcr && selectedProvider !== original.providerCode)
        changes.push(
          `Proveedor: ${original.providerCode} -> ${selectedProvider}`,
        );
      if (!isEditingPaidFcr && paddedInvoice !== original.invoiceNumber)
        changes.push(
          `Nro. factura: ${original.invoiceNumber} -> ${paddedInvoice}`,
        );
      if (!isEditingPaidFcr && paymentType !== original.paymentType)
        changes.push(`Tipo: ${original.paymentType} -> ${paymentType}`);
      const originalAmount = effectiveIsEgreso
        ? original.amountEgreso
        : original.amountIngreso;
      const newAmount = effectiveIsEgreso ? egresoValue : ingresoValue;
      const maxEditablePaidFcrAmount = Math.max(
        0,
        Math.trunc(Number(originalAmount) || 0),
      );
      if (isEditingPaidFcr && newAmount > maxEditablePaidFcrAmount) {
        const formatted = maxEditablePaidFcrAmount.toLocaleString("es-CR");
        setAmountError(
          `El monto no puede superar el monto original del movimiento (${formatted}).`,
        );
        showToast(
          "El monto no puede superar el monto original del movimiento.",
          "error",
          5000,
        );
        setIsSaving(false);
        editingInProgressRef.current = false;
        return;
      }
      if (
        !isEditingPaidFcr &&
        normalizeInvoiceDocType((original as any).invoiceDocType) === "FCR" &&
        typeof original.originalAmount === "number" &&
        original.originalAmount > 0 &&
        newAmount > original.originalAmount
      ) {
        const formatted = original.originalAmount.toLocaleString("es-CR");
        setAmountError(
          `El monto no puede superar el monto original de la factura (${formatted}).`,
        );
        showToast(
          "El monto no puede superar el monto original de la factura.",
          "error",
          5000,
        );
        setIsSaving(false);
        editingInProgressRef.current = false;
        return;
      }
      if (Number.isFinite(originalAmount) && originalAmount !== newAmount)
        changes.push(`Monto: ${originalAmount} -> ${newAmount}`);
      if (!isEditingPaidFcr && manager !== original.manager)
        changes.push(`Encargado: ${original.manager} -> ${manager}`);
      if (isEditingPaidFcr && effectiveManager2 !== originalManager2)
        changes.push(
          `Encargado pago: ${originalManager2 || "(vacío)"} -> ${effectiveManager2 || "(vacío)"}`,
        );
      if (trimmedNotes !== (original.notes ?? ""))
        changes.push(`Notas: "${original.notes}" -> "${trimmedNotes}"`);

      // Preparar el movimiento editado ANTES de persistir
      let updatedEntry: FondoEntry | null = null;
      const updatedEntries = fondoEntries.map((e: FondoEntry) => {
        if (e.id !== editingEntryId) return e;
        // append to existing history if present
        let history: any[] = [];
        try {
          const existing = e.auditDetails
            ? (JSON.parse(e.auditDetails) as any)
            : null;
          if (existing && Array.isArray(existing.history))
            history = existing.history.slice();
          else if (existing && existing.before && existing.after)
            history = [
              {
                at: existing.at ?? e.createdAt,
                before: existing.before,
                after: existing.after,
              },
            ];
        } catch {
          history = [];
        }

        // Validar límite máximo de ediciones
        if (history.length >= MAX_AUDIT_EDITS) {
          showToast(
            `No se pueden realizar más de ${MAX_AUDIT_EDITS} ediciones en un mismo movimiento`,
            "error",
          );
          return e; // No permitir más ediciones
        }

        const previousAppliedNotes = Array.isArray(e.appliedCreditNotes)
          ? (e.appliedCreditNotes as AppliedCreditNote[])
          : [];
        let remainingAppliedBase = effectiveIsEgreso ? egresoValue : 0;
        const nextAppliedCreditNotes: AppliedCreditNote[] = previousAppliedNotes.reduce(
          (acc: AppliedCreditNote[], note: AppliedCreditNote) => {
            if (remainingAppliedBase <= 0) return acc;
            const appliedAmount = Math.min(
              remainingAppliedBase,
              Math.max(0, Math.trunc(Number(note.appliedAmount) || 0)),
            );
            if (appliedAmount > 0) {
              acc.push({ ...note, appliedAmount });
              remainingAppliedBase -= appliedAmount;
            }
            return acc;
          },
          [] as AppliedCreditNote[],
        );
        const nextAppliedTotal = nextAppliedCreditNotes.reduce(
          (sum: number, note: AppliedCreditNote) => sum + Math.max(0, Math.trunc(note.appliedAmount)),
          0,
        );
        const nextAmountPayment =
          effectiveIsEgreso && nextAppliedCreditNotes.length > 0
            ? Math.max(0, egresoValue - nextAppliedTotal)
            : undefined;

        // Crear registro simplificado con solo los campos que cambiaron
        const changedFields = getChangedFields(
          {
            providerCode: e.providerCode,
            invoiceNumber: e.invoiceNumber,
            invoiceDocType: normalizeInvoiceDocType(
              (e as any).invoiceDocType,
            ),
            paymentType: e.paymentType,
            amountEgreso: e.amountEgreso,
            amountIngreso: e.amountIngreso,
            amountPayment: e.amountPayment,
            appliedCreditNotes: e.appliedCreditNotes,
            manager: e.manager,
            manager2: e.manager2,
            notes: e.notes,
            currency: e.currency,
          },
          {
            providerCode: effectiveProvider,
            invoiceNumber: effectiveInvoiceNumber,
            invoiceDocType: effectiveInvoiceDocType,
            paymentType: effectivePaymentType,
            amountEgreso: effectiveIsEgreso ? egresoValue : 0,
            amountIngreso: effectiveIsEgreso ? 0 : ingresoValue,
            amountPayment: nextAmountPayment,
            appliedCreditNotes: nextAppliedCreditNotes,
            manager: effectiveManager,
            manager2: effectiveManager2,
            notes: trimmedNotes,
            currency: effectiveCurrency,
          },
        );
        const newRecord = { at: new Date().toISOString(), ...changedFields };
        history.push(newRecord);
        // Comprimir historial para evitar QuotaExceededError
        const compressedHistory = compressAuditHistory(history);
        // keep original createdAt so chronological order and balances are preserved
        const baseAmountDue = Math.max(0, Math.trunc(Number(e.amountDue ?? e.balanceDue) || 0));
        const basePaymentAmount = Math.max(0, Math.trunc(Number(e.amountEgreso) || 0));
        const newPaymentAmount = effectiveIsEgreso ? egresoValue : 0;
        const nextAmountDue = isEditingPaidFcr
          ? Math.max(0, baseAmountDue - (newPaymentAmount - basePaymentAmount))
          : baseAmountDue;
        updatedEntry = {
          ...e,
          providerCode: effectiveProvider,
          invoiceNumber: effectiveInvoiceNumber,
          invoiceDocType: effectiveInvoiceDocType,
          accountId: accountKey,
          empresa: company,
          paymentType: effectivePaymentType,
          amountEgreso: effectiveIsEgreso ? egresoValue : 0,
          amountIngreso: effectiveIsEgreso ? 0 : ingresoValue,
          amountPayment: nextAmountPayment,
          amountDue: nextAmountDue,
          balanceDue: nextAmountDue,
          appliedCreditNotes:
            nextAppliedCreditNotes.length > 0
              ? nextAppliedCreditNotes
              : undefined,
          manager: effectiveManager,
          manager2: effectiveManager2 || undefined,
          notes: trimmedNotes,
          // mark as edited/audited and preserve originalEntryId (point to initial id)
          isAudit: true,
          originalEntryId: e.originalEntryId ?? e.id,
          auditDetails: JSON.stringify({ history: compressedHistory }),
          currency: effectiveCurrency,
        } as FondoEntry;
        return updatedEntry;
      });

      // PRIMERO persistir a Firestore, LUEGO actualizar UI
      const saved = await persistMovementToFirestore(updatedEntries, "edit", {
        upsert: updatedEntry ?? undefined,
        before: original,
      });

      if (!saved.ok) {
        showToast(
          "Error al guardar el movimiento. Por favor, intente de nuevo.",
          "error",
          5000,
        );
        setIsSaving(false);
        editingInProgressRef.current = false;
        return;
      }

      // Registrar timestamp de la última edición guardada
      lastEditSaveTimestampRef.current = Date.now();
      editingInProgressRef.current = false;

      // Solo actualizar la UI si el guardado fue exitoso
      setFondoEntries(updatedEntries);
      if (saved.ledgerSnapshot) {
        setLedgerSnapshot(saved.ledgerSnapshot);
      }

      // Mantener una copia en Facturas (best-effort)
      if (updatedEntry) {
        const facturaEntry = updatedEntry as FondoEntry;
        const normalizedCompany = (company || "").trim();
        if (isPaidFcrMovement(facturaEntry) && !isCajaNegra) {
          // Actualizar la factura original al editar un abono
          const paymentId = String(facturaEntry.id || "");
          const prefix = "fcr-pago-";
          if (paymentId.startsWith(prefix) && normalizedCompany.length > 0) {
            const rest = paymentId.slice(prefix.length);
            const invoiceIdMatch = rest.match(/^(FAC-\d+-[A-Z0-9]+)-/);
            if (invoiceIdMatch) {
              const invoiceId = invoiceIdMatch[1];
              const invoiceRef = FacturasService.buildMovementRef(normalizedCompany, invoiceId);
              try {
                const invoiceSnap = await getDoc(invoiceRef);
                if (invoiceSnap.exists()) {
                  const invoiceData = invoiceSnap.data() as FacturaMovement;
                  const oldPaymentAmount = Math.max(0, Math.trunc(Number(original.amountEgreso) || 0));
                  const newPaymentAmount = Math.max(0, Math.trunc(Number(facturaEntry.amountEgreso) || 0));
                  const diff = newPaymentAmount - oldPaymentAmount;
                  if (diff !== 0) {
                    const totalAmount = Math.max(0, Math.trunc(Number(invoiceData.originalAmount ?? invoiceData.amount) || 0));
                    const currentPaid = Math.max(0, Math.trunc(Number(invoiceData.paidAmount) || 0));
                    const nextPaid = Math.min(totalAmount, Math.max(0, currentPaid + diff));
                    const nextBalance = Math.max(0, totalAmount - nextPaid);
                    const nextStatus = nextBalance === 0 ? "PAGADA" : nextPaid > 0 ? "PARCIAL" : "PENDIENTE";
                    await FacturasService.upsertMovement(normalizedCompany, {
                      ...(invoiceData as any),
                      id: invoiceId,
                      empresa: normalizedCompany,
                      paidAmount: nextPaid,
                      balanceDue: nextBalance,
                      paymentStatus: nextStatus,
                    } as FacturaMovement);
                  }
                }
              } catch { /* fallo al leer factura */ }
            }
          }
        } else {
          if (normalizedCompany.length > 0) {
            if (shouldMirrorMovementToFacturas) {
              const facturaAmount = Math.abs(
                (facturaEntry.amountIngreso || 0) -
                  (facturaEntry.amountEgreso || 0),
              );
              const facturaCopy: FacturaMovement = {
                id: String(facturaEntry.id),
                empresa: normalizedCompany,
                accountId: accountKey,
                amount: facturaAmount,
                providerCode: facturaEntry.providerCode,
                invoiceNumber: facturaEntry.invoiceNumber,
                invoiceDocType: normalizeInvoiceDocType(
                  (facturaEntry as any).invoiceDocType,
                ),
                paymentType: facturaEntry.paymentType,
                amountEgreso: facturaEntry.amountEgreso,
                amountIngreso: facturaEntry.amountIngreso,
                amountPayment: facturaEntry.amountPayment,
                appliedCreditNotes: facturaEntry.appliedCreditNotes,
                manager: facturaEntry.manager,
                manager2: facturaEntry.manager2,
                notes: facturaEntry.notes,
                createdAt: facturaEntry.createdAt,
                currency: facturaEntry.currency === "USD" ? "USD" : "CRC",
              };
              void FacturasService.upsertMovement(
                normalizedCompany,
                facturaCopy,
              );
            }
          }
        }
      }
      if (saved.confirmed) {
        showToast("Movimiento editado correctamente", "success", 3000);
      } else {
        showToast(
          "Edición guardada localmente; pendiente de sincronización (revisa tu conexión).",
          "warning",
          6000,
        );
      }

      // Enviar notificación por correo si el proveedor tiene correonotifi
      const editedEntry = updatedEntries.find((e: FondoEntry) => e.id === editingEntryId);
      if (editedEntry) {
        sendMovementNotification(editedEntry, "edit", company, providers, showToast).catch((err) => {
          console.error(
            "[NOTIFICATION] Error en notificación de movimiento editado:",
            err,
          );
        });
      }

      try {
        // compute simple before/after CRC balances to help debug balance update issues
        const sumBalance = (entries: FondoEntry[]) => {
          let ingresosCRC = 0;
          let egresosCRC = 0;
          entries.forEach((en) => {
            const cur = (en.currency as "CRC" | "USD") || "CRC";
            if (cur === "CRC") {
              ingresosCRC += en.amountIngreso || 0;
              egresosCRC += resolveEffectiveEgresoAmount(en);
            }
          });
          return (Number(initialAmount) || 0) + ingresosCRC - egresosCRC;
        };
        const beforeBalance = sumBalance(fondoEntries);
        const afterBalance = sumBalance(updatedEntries);
        console.info("[FG-DEBUG] Edited movement saved", editingEntryId, {
          prevCount: fondoEntries.length,
          nextCount: updatedEntries.length,
          beforeBalanceCRC: beforeBalance,
          afterBalanceCRC: afterBalance,
        });
      } catch {
        console.info(
          "[FG-DEBUG] Edited movement saved (error computing debug balances)",
          editingEntryId,
        );
      }

      resetFondoForm();
      if (!movementAutoCloseLocked) {
        setMovementModalOpen(false);
      }
      setIsSaving(false);
      return;
    }

    // CREAR nuevo movimiento
    // If this is a CIERRE FONDO VENTAS movement, prevent concurrent Fondo General closings (and vice versa)
    let closingGuard: { token: string; docId: string } | null = null;
    try {
      const normalizedCompany = (company || "").trim();
      const requiresDuplicateInvoiceCheck =
        shouldMirrorMovementToFacturas &&
        isInventoryPurchasePaymentType(paymentType);
      const previousInvoiceMovement = requiresDuplicateInvoiceCheck
        ? await findLatestMovementByInvoiceNumber(
            normalizedCompany,
            paddedInvoice,
            selectedProvider,
          )
        : null;

      if (previousInvoiceMovement) {
        console.log(
          "[INVOICE-DUPLICATE] Coincidencia detectada antes de guardar COMPRA DE INVENTARIO.",
          {
            company: normalizedCompany,
            invoiceNumber: paddedInvoice,
            previousMovementId: previousInvoiceMovement.id,
          },
        );
      }

      const selectedProviderData = providers.find(
        (p: any) => p.code === selectedProvider,
      );
      const isCierreVentas =
        selectedProviderData?.name?.toUpperCase() ===
        CIERRE_FONDO_VENTAS_PROVIDER_NAME;
      // Enforce cross-device guard ONLY for regular users.
      // Admin/superadmin are allowed to create a closing even during the lock window.
      if (normalizedCompany.length > 0 && isCierreVentas && isRegularUser) {
        const acquired = await acquireClosingGuard(
          normalizedCompany,
          "FONDO_VENTAS",
          user,
          serverNowMs,
        );
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

      const nowDoc = new Date(nowISO);
      const iso = nowISO;
      // Use CR-timezone components for the document id to avoid UTC surprises when searching by hour.
      const crParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(nowDoc);
      const getPart = (t: string) => crParts.find((p) => p.type === t)?.value ?? "0";
      const yyyy = getPart("year");
      const MM = getPart("month");
      const DD = getPart("day");
      const HH = getPart("hour");
      const mm = getPart("minute");
      const ss = getPart("second");
      const mmm = String(nowDoc.getMilliseconds()).padStart(3, "0");
      const dateKey = `${yyyy}_${MM}_${DD}`; // YYYY_MM_DD (local)
      const timeKey = `${HH}_${mm}_${ss}_${mmm}`; // HH_MM_SS_mmm (local, URL-safe)
      const movementId = `${dateKey}-${timeKey}_${accountKey}`;
      const manualCreditNoteApplied =
        isEgreso &&
        effectiveInvoiceDocType === "FCO" &&
        manualCreditNoteDraft &&
        manualCreditNoteAppliedAmount > 0
          ? [
              {
                id: `manual-nc-${movementId}`,
                invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                amount: manualCreditNoteDraft.amount,
                appliedAmount: manualCreditNoteAppliedAmount,
                currency: movementCurrency,
                observation: manualCreditNoteDraft.observation,
              } as AppliedCreditNote,
            ]
          : [];
      const appliedCreditNotes = [
        ...creditNoteApplication.notes,
        ...manualCreditNoteApplied,
      ];
      const totalAppliedCreditNotes =
        creditNoteApplication.total +
        manualCreditNoteApplied.reduce(
          (sum, note) => sum + Math.max(0, Math.trunc(note.appliedAmount)),
          0,
        );
      const entry: FondoEntry = {
        id: movementId,
        empresa: company,
        accountId: accountKey,
        providerCode: selectedProvider,
        invoiceNumber: paddedInvoice,
        invoiceDocType: effectiveInvoiceDocType,
        paymentType,
        amountEgreso: isEgreso ? egresoValue : 0,
        amountIngreso: isIngreso ? ingresoValue : 0,
        amountPayment:
          isEgreso && effectiveInvoiceDocType === "FCO"
            ? roundCreditNotePaymentAmount(
                Math.max(0, egresoValue - totalAppliedCreditNotes),
                movementCurrency,
                accountKey,
              )
            : undefined,
        appliedCreditNotes:
           appliedCreditNotes.length > 0 ? appliedCreditNotes : undefined,
        manager: effectiveManager,
        notes: trimmedNotes,
        createdAt: iso,
        currency: movementCurrency,
      };

      // Crédito (FCR): se registra solo en Facturas y NO afecta el Fondo.
      if (effectiveInvoiceDocType === "FCR") {
        if (!shouldMirrorMovementToFacturas) {
          showToast(
            'Solo los proveedores de tipo "COMPRA INVENTARIO" pueden generar facturas.',
            "error",
            5000,
          );
          return;
        }
        const normalizedCompany = (company || "").trim();
        if (normalizedCompany.length === 0) {
          showToast(
            "No se pudo registrar la factura: falta empresa.",
            "error",
            5000,
          );
          return;
        }

        if (shouldMirrorMovementToFacturas) {
          const facturaCopy: FacturaMovement = {
            id: entry.id,
            empresa: normalizedCompany,
            accountId: accountKey,
            amount: Math.abs(
              (entry.amountIngreso || 0) - (entry.amountEgreso || 0),
            ),
            providerCode: entry.providerCode,
            invoiceNumber: entry.invoiceNumber,
            invoiceDocType: "FCR",
            paymentType: entry.paymentType,
            amountEgreso: entry.amountEgreso,
            amountIngreso: entry.amountIngreso,
            manager: entry.manager,
            notes: entry.notes,
            createdAt: entry.createdAt,
            currency: entry.currency === "USD" ? "USD" : "CRC",
          };

          await FacturasService.upsertMovement(
            normalizedCompany,
            facturaCopy,
          );
        }

        try {
          await ProvidersService.incrementMovementCount(
            normalizedCompany,
            selectedProvider,
          );
        } catch (err) {
          console.warn(
            "[FG] Could not increment provider movement count (FCR):",
            err,
          );
        }

        // Notificación por correo (mismo comportamiento)
        sendMovementNotification(entry, "create", company, providers, showToast).catch((err) => {
          console.error(
            "[NOTIFICATION] Error en notificación de movimiento (FCR):",
            err,
          );
        });

        showToast("Factura a crédito registrada", "success", 3000);
        resetFondoForm();
        if (!movementAutoCloseLocked) {
          setMovementModalOpen(false);
        }
        return;
      }

      // Preparar la lista actualizada ANTES de persistir
      const updatedEntries = [entry, ...fondoEntries];
      const createdOk = await persistCreatedMovement(entry, updatedEntries);

      if (createdOk && previousInvoiceMovement) {
        void sendDuplicateInvoiceAlertEmail({
          company,
          ownerAdminEmail,
          activeOwnerId,
          userEmail: user?.email,
          currentEntry: entry,
          previousEntry: previousInvoiceMovement,
          resolveProviderName: (providerCode: string) =>
            providers.find((p: any) => p.code === providerCode)?.name ||
            providerCode,
        });
      }

      if (createdOk) {
        try {
          if (normalizedCompany.length > 0) {
            await ProvidersService.incrementMovementCount(
              normalizedCompany,
              selectedProvider,
            );
          }
        } catch (err) {
          console.warn(
            "[FG] Could not increment provider movement count:",
            err,
          );
        }

        if (normalizedCompany.length > 0 && manualCreditNoteDraft) {
          try {
            if (shouldMirrorMovementToFacturas) {
              const manualCreditNoteMovement: FacturaMovement = {
                id: `${entry.id}-NC`,
                empresa: normalizedCompany,
                accountId: accountKey,
                amount: manualCreditNoteDraft.amount,
                amountEgreso: 0,
                amountIngreso: manualCreditNoteDraft.amount,
                amountPayment: manualCreditNoteDraft.amount,
                balanceDue: 0,
                createdAt: entry.createdAt,
                currency: movementCurrency,
                invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                manager,
                manager2: manager2 || undefined,
                notes: manualCreditNoteDraft.observation ?? "",
                invoiceDocType: "NC",
                paymentType,
                providerCode: selectedProvider,
                paidAmount: manualCreditNoteDraft.amount,
                paymentStatus: "PAGADA",
              };
              await FacturasService.upsertMovement(
                normalizedCompany,
                manualCreditNoteMovement,
              );
            }
          } catch (err) {
            console.warn("[FG] Could not upsert manual NC in Facturas:", err);
          }
        }

        if (
          normalizedCompany.length > 0 &&
          entry.appliedCreditNotes &&
          entry.appliedCreditNotes.length > 0
        ) {
          try {
            const batch = writeBatch(db);
            entry.appliedCreditNotes.forEach((note) => {
              const pendingNote = selectedProviderPendingCreditNotes.find(
                (item: any) => item.id === note.id,
              );
              if (!pendingNote) return;
              const nextPaidAmount = Math.min(
                pendingNote.amount,
                pendingNote.paidAmount + note.appliedAmount,
              );
              const nextBalanceDue = Math.max(
                0,
                pendingNote.amount - nextPaidAmount,
              );
              batch.set(
                FacturasService.buildMovementRef(normalizedCompany, note.id),
                {
                  paidAmount: nextPaidAmount,
                  balanceDue: nextBalanceDue,
                  paymentStatus: nextBalanceDue === 0 ? "REBAJADA" : "PARCIAL",
                  updateAt: entry.createdAt,
                },
                { merge: true },
              );
            });
            await batch.commit();
            setSelectedProviderPendingCreditNotes((prev: any[]) =>
              prev
                .map((note: any) => {
                  const applied = entry.appliedCreditNotes?.find(
                    (item: any) => item.id === note.id,
                  );
                  if (!applied) return note;
                  const paidAmount = Math.min(
                    note.amount,
                    note.paidAmount + applied.appliedAmount,
                  );
                  return {
                    ...note,
                    paidAmount,
                    balanceDue: Math.max(0, note.amount - paidAmount),
                  };
                })
                .filter((note: any) => note.balanceDue > 0),
            );
            setSelectedAppliedCreditNoteIds([]);
          } catch (err) {
            console.warn("[FG] Could not update applied credit notes:", err);
          }
        }

        if (
          normalizedCompany.length > 0 &&
          selectedPendingCreditInvoiceIds.length > 0
        ) {
          try {
            if (accountKey === "CajaNegra") {
              showToast(
                  "Desde Caja Negra no se debe gestionar facturas a crédito.",
                "error",
                4500,
              );
              setSelectedPendingCreditInvoiceIds([]);
            } else {
              const selectedIds = new Set(selectedPendingCreditInvoiceIds);
              const invoicesToPay = pendingClosingCreditInvoices.filter(
                (invoice: any) =>
                  selectedIds.has(invoice.id) &&
                  invoice.providerCode === selectedProvider &&
                  invoice.currency === movementCurrency,
              );

            if (invoicesToPay.length > 0) {
              const docId =
                MovimientosFondosService.buildCompanyMovementsKey(
                  normalizedCompany,
                );

              let baseStorage = null;
              try {
                baseStorage = await MovimientosFondosService.getDocument(docId);
              } catch {
                baseStorage = null;
              }

              const ledger =
                baseStorage ??
                MovimientosFondosService.createEmptyMovementStorage(
                  normalizedCompany,
                );
              ledger.company = normalizedCompany;
              ledger.operations = { movements: [] };

              const state =
                ledger.state ??
                MovimientosFondosService.createEmptyMovementStorage(
                  normalizedCompany,
                ).state;
              const acctKey = accountKey;
              const currency = movementCurrency as MovementCurrencyKey;
              const nowISO = entry.createdAt;
              let totalPaymentApplied = 0;

              const batch = writeBatch(db);

              const paymentMovements: Array<Record<string, unknown>> = [];

              invoicesToPay.forEach((invoice: any) => {
                const totalAmount = Math.max(
                  0,
                  Math.trunc(
                    Number(invoice.originalAmount ?? invoice.amount) || 0,
                  ),
                );
                const paidAmount = Math.max(
                  0,
                  Math.trunc(Number(invoice.paidAmount) || 0),
                );
                const balance = Math.max(
                  0,
                  Math.trunc(
                    Number(invoice.balanceDue ?? totalAmount - paidAmount) ||
                      0,
                  ),
                );
                if (balance <= 0) return;

                const nextPaidAmount = Math.min(
                  totalAmount,
                  paidAmount + balance,
                );
                const nextBalanceDue = Math.max(0, totalAmount - nextPaidAmount);
                const nextStatus =
                  nextBalanceDue === 0
                    ? "PAGADA"
                    : nextPaidAmount > 0
                      ? "PARCIAL"
                      : "PENDIENTE";

                const updatedMovement: FacturaMovement = {
                  ...invoice,
                  accountId: acctKey,
                  amount: totalAmount,
                  originalAmount: totalAmount,
                  amountDue: nextBalanceDue,
                  amountPayment: balance,
                  paidAmount: nextPaidAmount,
                  balanceDue: nextBalanceDue,
                  paymentStatus: nextStatus,
                  updateAt: nowISO,
                };

                batch.set(
                  FacturasService.buildMovementRef(
                    normalizedCompany,
                    invoice.id,
                  ),
                  stripUndefinedDeep(updatedMovement),
                  { merge: true },
                );

                const paymentMovement =
                  MovimientosFondosService.buildInvoicePaymentMovement({
                    company: normalizedCompany,
                    invoice: updatedMovement,
                    paymentAmount: balance,
                    updateAt: nowISO,
                    manager2: manager2?.trim() || undefined,
                  });
                paymentMovements.push(paymentMovement);

                const paymentMovementId = String(
                  (paymentMovement as any).id || "",
                );
                const movRef = MovimientosFondosService.buildMovementRef(
                  docId,
                  paymentMovementId,
                  acctKey,
                );
                batch.set(
                  movRef,
                  stripUndefinedDeep({
                    ...paymentMovement,
                    serverCreatedAt: serverTimestamp(),
                  }),
                );

                totalPaymentApplied += balance;
              });

              if (totalPaymentApplied > 0) {
                let found = false;
                state.balancesByAccount = state.balancesByAccount.map((b) => {
                  if (b.accountId === acctKey && b.currency === currency) {
                    const current =
                      typeof b.currentBalance === "number"
                        ? b.currentBalance
                        : b.initialBalance || 0;
                    const next = current - totalPaymentApplied;
                    found = true;
                    return { ...b, currentBalance: next };
                  }
                  return b;
                });
                if (!found) {
                  state.balancesByAccount.push({
                    accountId: acctKey,
                    currency,
                    enabled: true,
                    initialBalance: 0,
                    currentBalance: -totalPaymentApplied,
                  });
                }
                state.updatedAt = new Date().toISOString();
                ledger.state = state;

                const mainRef = doc(
                  db,
                  MovimientosFondosService.COLLECTION_NAME,
                  docId,
                );
                batch.set(mainRef, stripUndefinedDeep(ledger) as any);
                await batch.commit();

                setPendingClosingCreditInvoices((prev: any[]) =>
                  prev.filter((invoice) => !selectedIds.has(invoice.id)),
                );
                setSelectedPendingCreditInvoiceIds([]);

                storageSnapshotRef.current = stripUndefinedDeep(ledger) as any;
                try {
                  const cacheKey = buildV2MovementsCacheKey(
                    docId,
                    acctKey,
                  );
                  const cached = v2MovementsCacheRef.current[cacheKey];
                  if (cached?.loaded) {
                    const paymentEntries = paymentMovements.map((movement) => ({
                      ...(movement as unknown as FondoEntry),
                      id: String((movement as any).id || ""),
                    }));
                    v2MovementsCacheRef.current[cacheKey] = {
                      ...cached,
                      movements: [...paymentEntries, ...cached.movements],
                    };
                    rebuildEntriesFromV2Cache(docId, acctKey);
                  }
                  applyLedgerStateFromStorage(ledger.state);
                } catch (refreshErr) {
                  console.error(
                    "[FONDO] Error refreshing UI after credit invoice payment:",
                    refreshErr,
                  );
                }
              }
            }
            }
          } catch (err) {
            console.warn(
              "[FG] Could not update selected credit invoices:",
              err,
            );
          }
        }

        // Mantener copia en Facturas (best-effort)
        try {
          if (normalizedCompany.length > 0) {
            if (shouldMirrorMovementToFacturas) {
              const facturaCopy: FacturaMovement = {
                id: entry.id,
                empresa: normalizedCompany,
                accountId: accountKey,
                amount: Math.abs(
                  (entry.amountIngreso || 0) - (entry.amountEgreso || 0),
                ),
                providerCode: entry.providerCode,
                invoiceNumber: entry.invoiceNumber,
                invoiceDocType: "FCO",
                paymentType: entry.paymentType,
                amountEgreso: entry.amountEgreso,
                amountIngreso: entry.amountIngreso,
                amountPayment: entry.amountPayment,
                appliedCreditNotes: entry.appliedCreditNotes,
                manager: entry.manager,
                notes: entry.notes,
                createdAt: entry.createdAt,
                currency: entry.currency === "USD" ? "USD" : "CRC",
              };
              await FacturasService.upsertMovement(
                normalizedCompany,
                facturaCopy,
              );
            }
          }
        } catch (err) {
          console.warn("[FG] Could not upsert Facturas copy:", err);
        }
      }

      // If an admin/superadmin created a cierre, touch the guard on success so regular users
      // are blocked for the lock window.
      if (
        createdOk &&
        normalizedCompany.length > 0 &&
        isCierreVentas &&
        !isRegularUser
      ) {
        void touchClosingGuard(normalizedCompany, "FONDO_VENTAS", user, serverNowMs);
      }

      // If save failed, release guard so user can retry immediately.
      if (!createdOk && closingGuard) {
        try {
          if (normalizedCompany.length > 0) {
            void releaseClosingGuard(normalizedCompany, closingGuard);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      // Unexpected error: release guard to avoid blocking retries.
      try {
        const normalizedCompany = (company || "").trim();
        if (closingGuard && normalizedCompany.length > 0) {
          void releaseClosingGuard(normalizedCompany, closingGuard);
        }
      } catch {
        // ignore
      }
      throw err;
    }
  } finally {
    setIsSaving(false);
    movementSubmitInProgressRef.current = false;
  }
}
