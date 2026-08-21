// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/layout/Header";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  navigate: vi.fn(),
  pathname: "/",
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    logout: mocks.logout,
    user: { id: "user-1", name: "ALCHACAS", role: "user", permissions: {} },
  }),
}));
vi.mock("@/utils/client", () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  safeWindow: {
    location: {
      href: mocks.navigate,
      hash: vi.fn(),
      getHash: vi.fn(() => ""),
    },
  },
}));
vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
}));
vi.mock("@/services/solicitudes", () => ({
  SolicitudesService: {
    subscribePendingSolicitudesByEmpresa: vi.fn(() => () => undefined),
  },
}));
vi.mock("@/services/layoutPrefsDb", () => ({
  getLayoutPref: vi.fn(async () => null),
  setLayoutPref: vi.fn(async () => undefined),
}));
vi.mock("@/components/ui/FloatingActionsDock", () => ({
  useFloatingAction: vi.fn(),
}));
vi.mock("@/components/modals", () => ({
  ConfigurationModal: () => null,
  CalculatorModal: () => null,
  CashCounterModal: () => null,
  NotificationModal: () => null,
  MobileScanQrModal: () => null,
  DeviceLinkModal: () => null,
}));
vi.mock("@/components/session/FloatingSessionTimer", () => ({
  default: () => null,
}));
vi.mock("@/components/edicionPerfil/EditProfileModal", () => ({
  default: () => null,
}));
vi.mock("@/components/auth/PasskeyManagerModal", () => ({
  default: () => null,
}));
vi.mock("@/icons/icons", () => ({ CustomIcon: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("header logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/";
    mocks.logout.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    vi.stubGlobal(
      "Audio",
      class {
        preload = "";
        currentTime = 0;
        play = vi.fn(async () => undefined);
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens confirmation on home without starting logout", () => {
    render(<Header />);

    fireEvent.click(screen.getAllByTitle("Cerrar Sesión")[0]);

    expect(
      screen.getByRole("heading", { name: "Confirmar Cierre de Sesión" }),
    ).toBeTruthy();
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it.each(["/", "/home"])(
    "waits for confirmed logout before navigating from %s",
    async (pathname) => {
      const pendingLogout = deferred<void>();
      mocks.pathname = pathname;
      mocks.logout.mockReturnValueOnce(pendingLogout.promise);
      render(<Header />);

      fireEvent.click(screen.getAllByTitle("Cerrar Sesión")[0]);
      const heading = screen.getByRole("heading", {
        name: "Confirmar Cierre de Sesión",
      });
      fireEvent.click(
        within(heading.parentElement as HTMLElement).getByRole("button", {
          name: "Cerrar Sesión",
        }),
      );

      expect(mocks.logout).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).not.toHaveBeenCalled();

      pendingLogout.resolve(undefined);
      await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/"));
    },
  );
});
