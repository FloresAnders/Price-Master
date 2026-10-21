import { describe, expect, it, vi } from "vitest";

import {
  handleConfirmDailyClosing,
  type DailyClosingFailureReport,
} from "@/app/fondogeneral/utils/closing/dailyClosing";
import type { DailyClosingFormValues } from "@/app/fondogeneral/components/modals/DailyClosingModal";
import * as ledgerIntegrity from "@/app/fondogeneral/utils/closing/ledgerIntegrity";
import * as serverTime from "@/utils/serverTime";
import { DailyClosingsService } from "@/services/daily-closings";

describe("reporte de fallos del cierre de Fondo General", () => {
  it("reporta el motivo exacto cuando falta la configuración horaria", async () => {
    const reports: DailyClosingFailureReport[] = [];
    const closing: DailyClosingFormValues = {
      closingDate: "2026-10-20T20:14:00.000Z",
      manager: "Ana",
      notes: "Conteo revisado",
      totalCRC: 107_000,
      totalUSD: 120,
      breakdownCRC: { 20000: 5, 5000: 1, 2000: 1 },
      breakdownUSD: { 100: 1, 20: 1 },
      turno: "N",
      r08: 250_000,
      t11: 175_000,
      tucanCumulative: 249_500,
      tiemposCumulative: 174_000,
    };
    const showToast = vi.fn();

    const result = await handleConfirmDailyClosing(closing, {
      accountKey: "FondoGeneral",
      activeOwnerId: null,
      beginDailyClosingsRequest: vi.fn(),
      company: "DELIKOR PALMARES",
      currentBalanceCRC: 100_000,
      currentBalanceUSD: 100,
      dailyClosingSubmitInProgressRef: { current: false },
      dailyClosings: [],
      dailyClosingsRequestCountRef: { current: 0 },
      editingDailyClosingId: null,
      finishDailyClosingsRequest: vi.fn(),
      fondoEntries: [],
      formatToastWaitTime: (seconds) => `${seconds} segundos`,
      horarioApertura: null,
      horarioCierre: null,
      isRegularUser: true,
      lastDailyClosingSavedAtRef: { current: 0 },
      minutesAfterClose: null,
      authorizedOperationalDateKey: null,
      pendingNightDailyClosing: null,
      unicoCierre: false,
      requireSingleClosingReason: false,
      systemVerificationEnabled: true,
      solicitarApertura: true,
      loadedDailyClosingKeysRef: { current: new Set<string>() },
      loadingDailyClosingKeysRef: { current: new Set<string>() },
      ownerAdminEmail: null,
      persistMovementToFirestore: vi.fn(),
      reportDailyClosingFailure: async (failure) => {
        reports.push(failure);
      },
      setDailyClosingInitialValues: vi.fn(),
      setDailyClosingModalOpen: vi.fn(),
      setDailyClosings: vi.fn(),
      setDailyClosingsHydrated: vi.fn(),
      setEditingDailyClosingId: vi.fn(),
      setFondoEntries: vi.fn(),
      setLedgerSnapshot: vi.fn(),
      setPendingCierreDeCaja: vi.fn(),
      showToast,
      storageSnapshotRef: { current: null },
      user: { email: "cajero@example.com", role: "user" },
    });

    expect(result).toBeNull();
    expect(reports).toEqual([
      {
        phase: "validación de horario",
        outcome: "blocked",
        reason:
          "No se puede crear el cierre: configure horarios de apertura y cierre válidos.",
        userNotification:
          "No se puede crear el cierre: configure horarios de apertura y cierre válidos.",
        technicalDetails: "DAILY_CLOSING_SCHEDULE_REQUIRED",
      },
    ]);
    expect(showToast).toHaveBeenCalledWith(
      "No se puede crear el cierre: configure horarios de apertura y cierre válidos.",
      "warning",
      6000,
    );
  });

  it("reporta un cierre incompleto cuando falla su movimiento contable", async () => {
    vi.spyOn(serverTime, "getAuthoritativeNowISO").mockResolvedValue(
      "2026-10-20T20:15:30.000Z",
    );
    vi.spyOn(serverTime, "getAuthoritativeNowMs").mockResolvedValue(
      Date.parse("2026-10-20T20:15:30.000Z"),
    );
    vi.spyOn(ledgerIntegrity, "loadLedgerIntegrity").mockResolvedValue({
      ok: true,
      reason: "balanced",
      openingId: "opening-1",
      expectedCRC: 107_000,
      expectedUSD: 120,
      ledgerCRC: 107_000,
      ledgerUSD: 120,
      driftCRC: 0,
      driftUSD: 0,
      ledgerRevision: 8,
      ledgerUpdatedAt: "2026-10-20T20:14:30.000Z",
    });
    vi.spyOn(DailyClosingsService, "saveClosing").mockResolvedValue(null as never);

    const reports: DailyClosingFailureReport[] = [];
    const persistMovement = vi.fn().mockResolvedValue({
      ok: false,
      confirmed: false,
      errorReason: "PERMISSION_DENIED",
    });
    const closing: DailyClosingFormValues = {
      closingDate: "2026-10-20T20:14:00.000Z",
      manager: "Ana",
      notes: "Conteo revisado",
      totalCRC: 107_000,
      totalUSD: 120,
      breakdownCRC: { 20000: 5, 5000: 1, 2000: 1 },
      breakdownUSD: { 100: 1, 20: 1 },
      turno: "D",
      r08: 250_000,
      t11: 175_000,
      tucanCumulative: 249_500,
      tiemposCumulative: 174_000,
    };

    const result = await handleConfirmDailyClosing(closing, {
      accountKey: "FondoGeneral",
      activeOwnerId: null,
      beginDailyClosingsRequest: vi.fn(),
      company: "DELIKOR PALMARES",
      currentBalanceCRC: 107_000,
      currentBalanceUSD: 120,
      dailyClosingSubmitInProgressRef: { current: false },
      dailyClosings: [],
      dailyClosingsRequestCountRef: { current: 0 },
      editingDailyClosingId: null,
      finishDailyClosingsRequest: vi.fn(),
      fondoEntries: [],
      formatToastWaitTime: (seconds) => `${seconds} segundos`,
      horarioApertura: "06:00",
      horarioCierre: "22:00",
      isRegularUser: false,
      lastDailyClosingSavedAtRef: { current: 0 },
      minutesAfterClose: 30,
      authorizedOperationalDateKey: "2026-10-20",
      pendingNightDailyClosing: null,
      unicoCierre: true,
      requireSingleClosingReason: false,
      systemVerificationEnabled: false,
      solicitarApertura: true,
      loadedDailyClosingKeysRef: { current: new Set<string>() },
      loadingDailyClosingKeysRef: { current: new Set<string>() },
      ownerAdminEmail: null,
      persistMovementToFirestore: persistMovement,
      reportDailyClosingFailure: async (failure) => {
        reports.push(failure);
      },
      setDailyClosingInitialValues: vi.fn(),
      setDailyClosingModalOpen: vi.fn(),
      setDailyClosings: vi.fn(),
      setDailyClosingsHydrated: vi.fn(),
      setEditingDailyClosingId: vi.fn(),
      setFondoEntries: vi.fn(),
      setLedgerSnapshot: vi.fn(),
      setPendingCierreDeCaja: vi.fn(),
      showToast: vi.fn(),
      storageSnapshotRef: { current: null },
      user: { role: "admin" },
    });

    expect(result?.manager).toBe("Ana");
    expect(persistMovement).toHaveBeenCalledTimes(1);
    expect(reports).toEqual([
      {
        phase: "creación del movimiento contable posterior al cierre",
        outcome: "partial",
        reason:
          "El cierre se guardó, pero no se pudieron completar todos sus movimientos contables.",
        userNotification: null,
        technicalDetails:
          "No se pudo crear el movimiento de cierre 2026_10_20-14_15_30_000_CIERRE: PERMISSION_DENIED",
        currentBalanceCRC: 107_000,
        currentBalanceUSD: 120,
      },
    ]);
  });
});
