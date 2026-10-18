import { describe, expect, it, vi } from "vitest";
import { handleConfirmDailyClosing } from "@/app/fondogeneral/utils/closing/dailyClosing";
import { shouldBypassPendingNightDailyClosing } from "@/app/fondogeneral/utils/closing/pendingNightDailyClosing";
import { resolveAutomaticDailyClosingTurno } from "@/app/fondogeneral/utils/closing/singleClosingReason";
import { applyLedgerMovementMutation } from "@/app/fondogeneral/utils/fondo/ledgerState";
import type { FondoEntry } from "@/app/fondogeneral/types";
import { DailyClosingsService } from "@/services/daily-closings";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi
    .fn()
    .mockResolvedValue("2026-10-15T05:50:00.000Z"),
  getAuthoritativeNowMs: vi
    .fn()
    .mockResolvedValue(Date.parse("2026-10-15T05:50:00.000Z")),
}));

vi.mock("@/app/fondogeneral/utils/closing/ledgerIntegrity", () => ({
  buildOperationalStartISO: vi
    .fn()
    .mockReturnValue("2026-10-14T14:00:00.000Z"),
  formatLedgerIntegrityMismatch: vi.fn().mockReturnValue("ledger inválido"),
  loadLedgerIntegrity: vi
    .fn()
    .mockResolvedValue({
      ok: false,
      reason: "opening-missing",
      ledgerCRC: 141_000,
      ledgerUSD: 42,
      ledgerRevision: 7,
      ledgerUpdatedAt: "2026-10-15T05:49:00.000Z",
    }),
  loadPendingNightDailyClosingIntegrity: vi
    .fn()
    .mockResolvedValue({ ok: false, reason: "opening-missing" }),
}));

vi.mock("@/app/fondogeneral/utils/closing/closingGuards", () => ({
  acquireClosingGuard: vi.fn(),
  releaseClosingGuard: vi.fn(),
  touchClosingGuard: vi.fn(),
}));

vi.mock("@/data/gereaImagenSuperAdmin/dailyClosingImage", () => ({
  exportDailyClosingSuperAdminImage: vi.fn().mockResolvedValue(undefined),
}));

const buildLedgerWithOverdueNightClosing = () => {
  const storage =
    MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
      "DELIKOR COOPABUENA",
    );
  storage.state.pendingNightDailyClosing = {
    version: 1,
    movementId: "cierre-fv-n",
    turno: "N",
    createdAt: "2026-10-06T04:43:23.045Z",
    dueAt: "2026-10-06T05:45:00.000Z",
    operationalDateKey: "2026-10-05",
    manager: "MEGAN",
    minutesAfterEnd: 45,
  };
  return storage;
};

const newMovement = {
  id: "egreso-nuevo",
  createdAt: "2026-10-06T05:45:00.000Z",
  accountId: "FondoGeneral" as const,
  currency: "CRC" as const,
  amountEgreso: 5_000,
};

describe("bloqueo por cierre nocturno pendiente", () => {
  it("conserva el bloqueo para usuario regular cuando el campo falta o está activo", () => {
    expect(
      shouldBypassPendingNightDailyClosing({
        isAdminOrSuperAdmin: false,
      }),
    ).toBe(false);
    expect(
      shouldBypassPendingNightDailyClosing({
        isAdminOrSuperAdmin: false,
        bloquearCierre: true,
      }),
    ).toBe(false);
  });

  it("omite el bloqueo para usuario regular cuando la empresa lo desactiva", () => {
    expect(
      shouldBypassPendingNightDailyClosing({
        isAdminOrSuperAdmin: false,
        bloquearCierre: false,
      }),
    ).toBe(true);
  });

  it("mantiene la excepción administrativa aunque la empresa active el bloqueo", () => {
    expect(
      shouldBypassPendingNightDailyClosing({
        isAdminOrSuperAdmin: true,
        bloquearCierre: true,
      }),
    ).toBe(true);
  });

  it("mantiene bloqueado al usuario regular", () => {
    expect(() =>
      applyLedgerMovementMutation({
        storage: buildLedgerWithOverdueNightClosing(),
        operation: "create",
        nowISO: "2026-10-06T05:45:00.000Z",
        after: newMovement,
        bypassPendingNightDailyClosing: false,
      }),
    ).toThrow("PENDING_NIGHT_DAILY_CLOSING");
  });

  it("permite continuar a admin y superadmin sin eliminar el cierre pendiente", () => {
    const result = applyLedgerMovementMutation({
      storage: buildLedgerWithOverdueNightClosing(),
      operation: "create",
      nowISO: "2026-10-06T05:45:00.000Z",
      after: newMovement,
      bypassPendingNightDailyClosing: true,
    });

    expect(result.storage.state.pendingNightDailyClosing?.movementId).toBe(
      "cierre-fv-n",
    );
    expect(result.ledgerSnapshot.currentCRC).toBe(-5_000);
  });
});

describe("turno automatico del cierre diario", () => {
  it("clasifica como N un cierre unico excepcional aunque no exista cierre D", () => {
    expect(
      resolveAutomaticDailyClosingTurno({
        empresaUsesSingleClosing: false,
        requiresSingleClosingReason: true,
        hasRealD: false,
      }),
    ).toBe("N");
  });

  it.each([
    [true, false, false, "N"],
    [false, false, true, "N"],
    [false, false, false, "D"],
  ] as const)(
    "resuelve unicoCierre=%s motivoUnico=%s cierreD=%s como %s",
    (
      empresaUsesSingleClosing,
      requiresSingleClosingReason,
      hasRealD,
      expected,
    ) => {
      expect(
        resolveAutomaticDailyClosingTurno({
          empresaUsesSingleClosing,
          requiresSingleClosingReason,
          hasRealD,
        }),
      ).toBe(expected);
    },
  );
});

describe("cierre diario N sin cierre D", () => {
  const closing = {
    closingDate: "2026-10-15T05:46:47.877Z",
    manager: "FABIAN",
    notes: "",
    singleClosingReason: "FONDOS INSUFICIENTES TURNO DIURNO",
    noMovements: false,
    noMovementsReason: "",
    totalCRC: 141_000,
    totalUSD: 42,
    breakdownCRC: {},
    breakdownUSD: {},
    turno: "N" as const,
    r08: 0,
    t11: 0,
    tucanCumulative: 0,
    tiemposCumulative: 0,
  };

  const buildDeps = (showToast: ReturnType<typeof vi.fn>) =>
    ({
      accountKey: "FondoGeneral",
      activeOwnerId: "owner",
      beginDailyClosingsRequest: vi.fn(),
      company: "DELIKOR SINAI",
      currentBalanceCRC: 141_000,
      currentBalanceUSD: 42,
      dailyClosingSubmitInProgressRef: { current: false },
      dailyClosings: [],
      dailyClosingsRequestCountRef: { current: 0 },
      editingDailyClosingId: null,
      finishDailyClosingsRequest: vi.fn(),
      fondoEntries: [],
      formatToastWaitTime: vi.fn(),
      horarioApertura: "08:00",
      horarioCierre: "23:59",
      isRegularUser: true,
      lastDailyClosingSavedAtRef: { current: 0 },
      minutesAfterClose: 45,
      authorizedOperationalDateKey: "2026-10-14",
      pendingNightDailyClosing: null,
      unicoCierre: false,
      requireSingleClosingReason: true,
      systemVerificationEnabled: false,
      solicitarApertura: true,
      loadedDailyClosingKeysRef: { current: new Set<string>() },
      loadingDailyClosingKeysRef: { current: new Set<string>() },
      ownerAdminEmail: null,
      persistMovementToFirestore: vi.fn(),
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
      user: { role: "user" },
    }) as any;

  it("permite avanzar el cierre N excepcional cuando pasó el turno D", async () => {
    const showToast = vi.fn();

    await handleConfirmDailyClosing(closing, buildDeps(showToast));

    expect(showToast).not.toHaveBeenCalledWith(
      "Debe existir cierre diurno antes del nocturno.",
      "warning",
      5000,
    );
    expect(showToast).toHaveBeenCalledWith(
      "No se puede cerrar el fondo. No se encontró una apertura para el día operativo. Solicite revisión administrativa.",
      "error",
      6000,
    );
  });

  it("mantiene bloqueado un cierre N normal sin cierre D", async () => {
    const showToast = vi.fn();
    const deps = buildDeps(showToast);
    deps.requireSingleClosingReason = false;

    await handleConfirmDailyClosing(closing, deps);

    expect(showToast).toHaveBeenCalledWith(
      "Debe existir cierre diurno antes del nocturno.",
      "warning",
      5000,
    );
  });

  it("permite al superadmin cerrar aunque no exista apertura operativa", async () => {
    const showToast = vi.fn();
    const deps = buildDeps(showToast);
    deps.isRegularUser = false;
    deps.user = { role: "superadmin" };
    deps.persistMovementToFirestore.mockResolvedValue({
      ok: true,
      confirmed: true,
    });
    const saveClosing = vi
      .spyOn(DailyClosingsService, "saveClosing")
      .mockResolvedValue(null);

    try {
      const result = await handleConfirmDailyClosing(closing, deps);

      expect(showToast).not.toHaveBeenCalledWith(
        "No se puede cerrar el fondo. No se encontró una apertura para el día operativo. Solicite revisión administrativa.",
        "error",
        6000,
      );
      expect(saveClosing).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        manager: "FABIAN",
        recordedBalanceCRC: 141_000,
        recordedBalanceUSD: 42,
      });
    } finally {
      saveClosing.mockRestore();
    }
  });
});
