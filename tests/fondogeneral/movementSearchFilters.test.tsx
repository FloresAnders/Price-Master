// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ db: {} }));

import { FondoDateRangeFilters } from "@/app/fondogeneral/components/FondoDateRangeFilters";
import { useFondoFilters } from "@/app/fondogeneral/hooks/fondo/useFondoFilters";
import type { FondoEntry } from "@/app/fondogeneral/types";
import {
  resolveActiveMovementsQuery,
  shouldApplyAutomaticMovementRange,
  shouldShowMovementSearchButton,
} from "@/app/fondogeneral/utils/v2movements";
import { ensureV2MovementsLoaded } from "@/app/fondogeneral/utils/v2movementsLoader";

const movements: FondoEntry[] = [
  {
    id: "movement-1",
    providerCode: "PROVIDER_A",
    invoiceNumber: "0012",
    paymentType: "COMPRA INVENTARIO",
    amountEgreso: 1000,
    amountIngreso: 0,
    manager: "ANA",
    notes: "Depósito nocturno",
    createdAt: "2026-09-07T12:00:00.000Z",
    accountId: "FondoGeneral",
  },
  {
    id: "movement-2",
    providerCode: "PROVIDER_B",
    invoiceNumber: "1200",
    paymentType: "SERVICIOS",
    amountEgreso: 2000,
    amountIngreso: 0,
    manager: "LUIS",
    notes: "Compra semanal",
    createdAt: "2026-09-07T13:00:00.000Z",
    accountId: "FondoGeneral",
  },
];

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("consulta exacta de movimientos del Fondo General", () => {
  it("incluye proveedor, tipo y factura en la identidad de la consulta", () => {
    const query = resolveActiveMovementsQuery({
      fromFilter: "2026-09-01",
      toFilter: "2026-09-07",
      pageSize: "all",
      currentDailyKey: "2026-09-07",
      todayKey: "2026-09-07",
      providerCode: " PROVIDER_A ",
      paymentType: " COMPRA INVENTARIO ",
      invoiceNumber: " 0012 ",
    });

    expect(query).toMatchObject({
      providerCode: "PROVIDER_A",
      paymentType: "COMPRA INVENTARIO",
      invoiceNumber: "0012",
      startIso: "2026-09-01T06:00:00.000Z",
      endIsoExclusive: "2026-09-08T06:00:00.000Z",
    });
    expect(query.queryKey).toContain('"providerCode":"PROVIDER_A"');
    expect(query.queryKey).toContain('"paymentType":"COMPRA INVENTARIO"');
    expect(query.queryKey).toContain('"invoiceNumber":"0012"');
  });

  it("envía los filtros exactos a la lectura remota", async () => {
    let receivedOptions: Record<string, unknown> | null = null;
    const cacheRef: Parameters<
      typeof ensureV2MovementsLoaded
    >[2]["v2MovementsCacheRef"] = { current: {} };

    await ensureV2MovementsLoaded("company-key", undefined, {
      rebuildEntriesFromV2Cache: vi.fn(),
      beginMovementsLoading: vi.fn(),
      endMovementsLoading: vi.fn(),
      pageSize: "all",
      currentDailyKey: "2026-09-07",
      todayKey: "2026-09-07",
      fromFilter: "2026-09-01",
      toFilter: "2026-09-07",
      providerCode: "PROVIDER_A",
      paymentType: "COMPRA INVENTARIO",
      invoiceNumber: "0012",
      accountKeyRef: { current: "FondoGeneral" },
      v2MovementsCacheRef: cacheRef,
      loadRemotePage: async (_docKey, options) => {
        receivedOptions = options as unknown as Record<string, unknown>;
        return { items: [], cursor: null, exhausted: true };
      },
    });

    expect(receivedOptions).toMatchObject({
      accountId: "FondoGeneral",
      startIso: "2026-09-01T06:00:00.000Z",
      endIsoExclusive: "2026-09-08T06:00:00.000Z",
      providerCode: "PROVIDER_A",
      paymentType: "COMPRA INVENTARIO",
      invoiceNumber: "0012",
    });
    expect(receivedOptions).not.toHaveProperty("notes");
  });
});

describe("aplicación de filtros en la tabla", () => {
  it("mantiene proveedor y factura pendientes hasta ejecutar Buscar", () => {
    const { result } = renderHook(() =>
      useFondoFilters({
        fondoEntries: movements,
        movementProviders: [
          { code: "PROVIDER_A", name: "Proveedor A" },
          { code: "PROVIDER_B", name: "Proveedor B" },
        ],
        mode: "all",
        serverFilteringEnabled: true,
      }),
    );

    act(() => {
      result.current.setFromFilter("2026-09-07");
      result.current.setToFilter("2026-09-07");
      result.current.setFilterProviderCode("PROVIDER_A");
      result.current.setSearchQuery("0012");
    });

    expect(result.current.filteredEntries.map((entry) => entry.id)).toEqual([
      "movement-2",
      "movement-1",
    ]);

    act(() => result.current.applyServerSearchFilters());

    expect(result.current.filteredEntries.map((entry) => entry.id)).toEqual([
      "movement-1",
    ]);
  });

  it("filtra notas parcialmente sobre los movimientos cargados", () => {
    const { result } = renderHook(() =>
      useFondoFilters({
        fondoEntries: movements,
        movementProviders: [],
        mode: "all",
        serverFilteringEnabled: true,
      }),
    );

    act(() => result.current.setNotesSearchQuery("NOCTUR"));

    expect(result.current.filteredEntries.map((entry) => entry.id)).toEqual([
      "movement-1",
    ]);
  });

  it("compara el número de factura de forma exacta", () => {
    const { result } = renderHook(() =>
      useFondoFilters({
        fondoEntries: movements,
        movementProviders: [],
        mode: "all",
        serverFilteringEnabled: true,
      }),
    );

    act(() => {
      result.current.setFromFilter("2026-09-07");
      result.current.setToFilter("2026-09-07");
      result.current.setSearchQuery("12");
    });
    act(() => result.current.applyServerSearchFilters());

    expect(result.current.filteredEntries).toEqual([]);
  });
});

describe("rangos predeterminados", () => {
  it("se aplican inmediatamente aunque haya filtros remotos pendientes", () => {
    expect(
      shouldApplyAutomaticMovementRange({
        accountKey: "FondoGeneral",
        hasFirestoreFilterDraft: true,
      }),
    ).toBe(true);
  });

  it("muestra Buscar para un rango personalizado o filtros remotos", () => {
    expect(
      shouldShowMovementSearchButton({
        accountKey: "FondoGeneral",
        entriesHydrated: true,
        fromFilter: "2026-09-01",
        toFilter: "2026-09-07",
        quickRange: null,
        hasFirestoreFilterDraft: false,
      }),
    ).toBe(true);
    expect(
      shouldShowMovementSearchButton({
        accountKey: "FondoGeneral",
        entriesHydrated: true,
        fromFilter: "2026-09-01",
        toFilter: "2026-09-07",
        quickRange: "last30",
        hasFirestoreFilterDraft: true,
      }),
    ).toBe(true);
    expect(
      shouldShowMovementSearchButton({
        accountKey: "FondoGeneral",
        entriesHydrated: true,
        fromFilter: "2026-09-01",
        toFilter: "2026-09-07",
        quickRange: "last30",
        hasFirestoreFilterDraft: false,
      }),
    ).toBe(false);
  });

  it("publica Últimos 30 días inmediatamente al seleccionarlo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 7, 10, 0));
    const onQuickRangeResolved = vi.fn();

    render(
      <FondoDateRangeFilters
        quickRange={null}
        todayKey="2026-09-07"
        fromFilter={null}
        toFilter={null}
        calendarFromOpen={false}
        calendarToOpen={false}
        calendarFromMonth={new Date(2026, 8, 1)}
        calendarToMonth={new Date(2026, 8, 1)}
        formatKeyToDisplay={(key) => key}
        setQuickRange={vi.fn()}
        setFromFilter={vi.fn()}
        setToFilter={vi.fn()}
        setPageSize={vi.fn()}
        setPageIndex={vi.fn()}
        setCalendarFromOpen={vi.fn()}
        setCalendarToOpen={vi.fn()}
        setCalendarFromMonth={vi.fn()}
        setCalendarToMonth={vi.fn()}
        fromCalendarRef={{ current: null }}
        toCalendarRef={{ current: null }}
        fromButtonRef={{ current: null }}
        toButtonRef={{ current: null }}
        onQuickRangeResolved={onQuickRangeResolved}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "last30" },
    });

    expect(onQuickRangeResolved).toHaveBeenCalledWith({
      quickRange: "last30",
      from: "2026-08-09",
      to: "2026-09-07",
    });
  });
});
