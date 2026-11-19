// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FondoFiltersToolbar } from "@/app/fondogeneral/components/FondoFiltersToolbar";
import { ResponsiveMovementViews } from "@/app/fondogeneral/components/ResponsiveMovementViews";

vi.mock("@/app/fondogeneral/components/FondoDateRangeFilters", () => ({
  FondoDateRangeFilters: () => null,
}));

function createProps(): ComponentProps<typeof FondoFiltersToolbar> {
  return {
    filterProviderCode: "P001",
    setFilterProviderCode: vi.fn(),
    setProviderFilter: vi.fn(),
    providerSearchInput: "Proveedor Uno (P001)",
    setProviderSearchInput: vi.fn(),
    isProviderDropdownOpen: true,
    setIsProviderDropdownOpen: vi.fn(),
    movementProvidersLoading: false,
    filteredProvidersForFilter: [{ code: "P001", name: "Proveedor Uno" }],
    filterPaymentType: "VENTA",
    setFilterPaymentType: vi.fn(),
    setTypeFilter: vi.fn(),
    typeSearchInput: "Venta",
    setTypeSearchInput: vi.fn(),
    isTypeDropdownOpen: true,
    setIsTypeDropdownOpen: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    notesSearchQuery: "",
    setNotesSearchQuery: vi.fn(),
    filtersDropdownRef: { current: null },
    filtersDropdownOpen: true,
    setFiltersDropdownOpen: vi.fn(),
    showPendingClosingCreditInvoices: false,
    setShowPendingClosingCreditInvoices: vi.fn(),
    filterEditedOnly: false,
    setFilterEditedOnly: vi.fn(),
    quickRange: null,
    todayKey: "2026-11-16",
    fromFilter: null,
    setFromFilter: vi.fn(),
    toFilter: null,
    setToFilter: vi.fn(),
    calendarFromOpen: false,
    setCalendarFromOpen: vi.fn(),
    calendarToOpen: false,
    setCalendarToOpen: vi.fn(),
    calendarFromMonth: new Date("2026-11-01T00:00:00-06:00"),
    setCalendarFromMonth: vi.fn(),
    calendarToMonth: new Date("2026-11-01T00:00:00-06:00"),
    setCalendarToMonth: vi.fn(),
    formatKeyToDisplay: (key) => key,
    setQuickRange: vi.fn(),
    setPageSize: vi.fn(),
    setPageIndex: vi.fn(),
    fromCalendarRef: { current: null },
    toCalendarRef: { current: null },
    fromButtonRef: { current: null },
    toButtonRef: { current: null },
    accountKey: "FondoGeneral",
    isCajaNegra: false,
    setDailyClosingHistoryRange: vi.fn(),
    setDailyClosingHistoryOpen: vi.fn(),
    closingsAreLoading: false,
    pendingCierreDeCaja: false,
    handleOpenDailyClosing: vi.fn(),
    handleOpenCreateMovement: vi.fn(),
    entriesHydrated: true,
    refreshMovements: vi.fn(),
    movementsRefreshing: false,
    searchingMovements: false,
    showSearchButton: false,
    onSearch: vi.fn(),
    resetAppliedSearchFilters: vi.fn(),
    onQuickRangeResolved: vi.fn(),
  };
}

describe("FondoFiltersToolbar accessibility", () => {
  afterEach(() => cleanup());

  it("exposes searchable filters as named comboboxes with listboxes", () => {
    render(<FondoFiltersToolbar {...createProps()} />);

    const provider = screen.getByRole("combobox", { name: "Proveedor" });
    const providerOptions = screen.getByRole("listbox", {
      name: "Opciones de proveedor",
    });
    expect(provider.getAttribute("aria-controls")).toBe(providerOptions.id);
    expect(provider.getAttribute("aria-expanded")).toBe("true");

    const movementType = screen.getByRole("combobox", {
      name: "Tipo de movimiento",
    });
    const typeOptions = screen.getByRole("listbox", {
      name: "Opciones de tipo de movimiento",
    });
    expect(movementType.getAttribute("aria-controls")).toBe(typeOptions.id);
    expect(movementType.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps clear actions in keyboard order and treats Vista as a disclosure", () => {
    render(<FondoFiltersToolbar {...createProps()} />);

    expect(
      screen.getByRole("button", { name: "Limpiar proveedor" }).tabIndex,
    ).toBe(0);
    expect(
      screen.getByRole("button", { name: "Limpiar tipo de movimiento" })
        .tabIndex,
    ).toBe(0);

    const viewButton = screen.getByRole("button", { name: "Vista" });
    expect(viewButton.hasAttribute("aria-haspopup")).toBe(false);
    expect(viewButton.getAttribute("aria-expanded")).toBe("true");
    expect(viewButton.getAttribute("aria-controls")).toBeTruthy();
  });

  it("navigates and selects combobox options from the keyboard", () => {
    const props = createProps();
    render(<FondoFiltersToolbar {...props} />);

    const provider = screen.getByRole("combobox", { name: "Proveedor" });
    fireEvent.keyDown(provider, { key: "ArrowDown" });
    expect(provider.getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.keyDown(provider, { key: "Enter" });
    expect(props.setFilterProviderCode).toHaveBeenCalledWith("P001");
    expect(props.setIsProviderDropdownOpen).toHaveBeenCalledWith(false);

    const movementType = screen.getByRole("combobox", {
      name: "Tipo de movimiento",
    });
    fireEvent.keyDown(movementType, { key: "Escape" });
    expect(props.setIsTypeDropdownOpen).toHaveBeenCalledWith(false);
  });

  it("shows immediate validation feedback while opening a movement", () => {
    render(
      <FondoFiltersToolbar
        {...createProps()}
        createMovementOpening
      />,
    );

    const button = screen.getByRole("button", { name: "Validando movimiento" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("Validando...");
  });

  it("shows immediate validation feedback while opening a daily closing", () => {
    render(
      <FondoFiltersToolbar
        {...createProps()}
        dailyClosingOpening
      />,
    );

    const button = screen.getByRole("button", { name: "Validando cierre" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("Validando...");
  });
});

describe("ResponsiveMovementViews", () => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let matches = false;

  beforeEach(() => {
    matches = false;
    listeners.clear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((media: string) => ({
        media,
        get matches() {
          return matches;
        },
        onchange: null,
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => listeners.add(listener),
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void,
        ) => listeners.delete(listener),
        addListener: (listener: (event: MediaQueryListEvent) => void) =>
          listeners.add(listener),
        removeListener: (listener: (event: MediaQueryListEvent) => void) =>
          listeners.delete(listener),
        dispatchEvent: () => true,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invokes and mounts only the renderer for the active breakpoint", () => {
    const renderMobile = vi.fn(() => <p>Vista móvil</p>);
    const renderDesktop = vi.fn(() => <p>Vista escritorio</p>);

    render(
      <ResponsiveMovementViews
        renderMobile={renderMobile}
        renderDesktop={renderDesktop}
      />,
    );

    expect(screen.getByText("Vista escritorio")).toBeTruthy();
    expect(screen.queryByText("Vista móvil")).toBeNull();
    expect(renderDesktop).toHaveBeenCalledTimes(1);
    expect(renderMobile).not.toHaveBeenCalled();

    matches = true;
    act(() => {
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent),
      );
    });

    expect(screen.getByText("Vista móvil")).toBeTruthy();
    expect(screen.queryByText("Vista escritorio")).toBeNull();
    expect(renderMobile).toHaveBeenCalledTimes(1);
  });
});
