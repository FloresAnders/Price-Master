// @vitest-environment jsdom
//
// Measures how many times HomeMenu's permission/derivation chain recomputes per
// render. React Compiler is not enabled, so a value rebuilt in the component body
// (e.g. `const visibleMenuItems = getVisibleMenuItems()`) becomes a new identity
// every render and invalidates every `useMemo`/`useEffect` that depends on it.
//
// The probe is `getDefaultPermissions` (called by HomeMenu when the user has no
// explicit `permissions`): one call per derivation pass.
import React, { useState } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: { src?: string; alt?: string }) =>
    React.createElement("img", { src: props.src, alt: props.alt }),
}));
vi.mock("../src/components/ui/AnimatedStickman", () => ({
  default: () => React.createElement("div", null, null),
}));
vi.mock("../src/components/business/SupplierWeekSection", () => ({
  SupplierWeekSection: () => React.createElement("div", null, null),
}));
vi.mock("../src/hooks/useProviders", () => ({
  useProviders: () => ({ providers: [], loading: false, error: null }),
}));
vi.mock("../src/hooks/useControlPedido", () => ({
  useControlPedido: () => ({
    entries: [],
    loading: false,
    error: null,
    addOrder: async () => {},
    deleteOrdersForProviderReceiveDay: async () => {},
  }),
}));
vi.mock("../src/services/empresas", () => ({
  EmpresasService: { getAllEmpresas: async () => [] },
}));
vi.mock("../src/services/movimientos-fondos", () => ({
  MovimientosFondosService: {
    buildCompanyMovementsKey: (c: string) => c,
    getDocument: async () => null,
    ensureMovementStorageShape: (v: unknown) => v,
  },
}));
vi.mock("../src/services/homeMenuFavoritesDb", () => ({
  getHomeMenuOrder: async () => [],
  setHomeMenuOrder: async () => {},
  getHomeMenuFavorites: async () => [],
  addHomeMenuFavorite: async () => {},
  removeHomeMenuFavorite: async () => {},
}));
vi.mock("@/utils/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/permissions")>();
  return { ...actual, getDefaultPermissions: vi.fn(actual.getDefaultPermissions) };
});

import HomeMenu from "@/components/layout/HomeMenu";
import * as permissionsModule from "@/utils/permissions";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(cleanup);

function Harness({ user }: { user: unknown }) {
  const [tick, setTick] = useState(0);
  return (
    <div>
      <button onClick={() => setTick((t) => t + 1)}>bump {tick}</button>
      <HomeMenu currentUser={user as never} />
    </div>
  );
}

describe("HomeMenu derivation cost", () => {
  it("does not recompute the permission chain on unrelated re-renders", () => {
    const getDefaultPermissions = permissionsModule.getDefaultPermissions as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[] };
    };
    getDefaultPermissions.mockClear();

    const stableUser = { id: "perf-user", role: "user" };
    const { getByText } = render(<Harness user={stableUser} />);

    const afterMount = getDefaultPermissions.mock.calls.length;

    const RE_RENDERS = 10;
    for (let i = 0; i < RE_RENDERS; i++) {
      fireEvent.click(getByText(/^bump/));
    }

    const total = getDefaultPermissions.mock.calls.length;

    console.log(
      `[home-menu] reRenders=${RE_RENDERS} permissionChainCalls_afterMount=${afterMount} total=${total}`,
    );

    // The chain runs on mount, and must NOT run again for renders that keep the
    // same `currentUser` reference.
    expect(afterMount).toBeGreaterThan(0);
    expect(total).toBe(afterMount);
  });
});
