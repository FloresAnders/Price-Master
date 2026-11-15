// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    <img {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => vi.fn()),
}));

vi.mock("@/config/firebase", () => ({ db: {} }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: {
      id: "mobile-user",
      name: "ALCHACAS",
      role: "superadmin",
      permissions: {},
    },
  }),
}));

vi.mock("@/contexts/SessionListenerPreferencesContext", () => ({
  useSessionListenerPreferences: () => ({
    preferences: { pendingCompanyRequests: false },
    loaded: true,
  }),
}));

vi.mock("@/components/ui/FloatingActionsDock", () => ({
  useFloatingAction: vi.fn(),
}));

vi.mock("@/components/announcements/SystemAnnouncementsBanner", () => ({
  default: () => null,
}));

vi.mock("@/components/celebraciones", () => ({
  PatrioticSeptemberBadge: () => null,
  isCostaRicaIndependenceSeason: () => false,
}));

vi.mock("@/services/layoutPrefsDb", () => ({
  getLayoutPref: vi.fn(async () => null),
  setLayoutPref: vi.fn(async () => undefined),
  shouldSubscribePendingCompanyRequests: () => false,
}));

vi.mock("@/services/closing-time-extensions", () => ({
  normalizeClosingTimeExtensionCompanyKey: (value: string) => value,
}));

vi.mock("@/services/solicitudes", () => ({
  SolicitudesService: {
    subscribePendingSolicitudesByEmpresa: vi.fn(() => vi.fn()),
  },
}));

vi.mock("@/components/business/cash-counter-tabs/accountCounters", () => ({
  OPEN_CASH_COUNTER_EVENT: "price-master:open-cash-counter",
}));

vi.mock("@/components/modals", () => ({
  ConfigurationModal: () => null,
  CalculatorModal: () => null,
  CashCounterModal: () => null,
  NotificationModal: () => null,
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

import Header from "@/components/layout/Header";

afterEach(cleanup);

describe("mobile header logout", () => {
  const renderMobileLogoutButton = () => {
    render(<Header />);

    fireEvent.click(screen.getByTitle("Menú"));
    const mobileUserActions = screen.getByTitle("Menú de usuario").parentElement;
    expect(mobileUserActions).not.toBeNull();
    return within(mobileUserActions!).getByTitle("Cerrar Sesión");
  };

  it("opens logout confirmation when activated", () => {
    const logoutButton = renderMobileLogoutButton();

    fireEvent.click(logoutButton);

    expect(
      screen.getByRole("heading", { name: "Confirmar Cierre de Sesión" }),
    ).toBeInTheDocument();
  });

  it("provides a reliable touch target", () => {
    const logoutButton = renderMobileLogoutButton();

    expect(logoutButton).toHaveClass("h-11", "w-11", "shrink-0", "touch-manipulation");
  });
});
