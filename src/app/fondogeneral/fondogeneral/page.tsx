"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Loader2,
  Lock,
  ShieldAlert,
  Coins,
  type LucideIcon,
} from "lucide-react";
import { FondoSection } from "../components/fondo";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultPermissions } from "@/utils/permissions";

type TabId = "fondo" | "bcr" | "bn" | "bac" | "cajanegra";
type FondoTab = {
  id: TabId;
  label: string;
  namespace: "fg" | "bcr" | "bn" | "bac" | "cn";
};

const TAB_VISUALS: Record<
  TabId,
  {
    icon?: LucideIcon;
    logoSrc?: string;
    shortLabel: string;
    helper: string;
    tone: string;
    activeTone: string;
  }
> = {
  fondo: {
    icon: Coins,
    shortLabel: "General",
    helper: "Caja principal",
    tone: "bg-gradient-to-br from-blue-500/15 to-blue-700/10 border-blue-400/35 shadow-lg shadow-blue-500/20",
    activeTone:
      "bg-gradient-to-br from-blue-500/25 to-blue-700/20 border-blue-300/70 shadow-xl shadow-blue-400/30",
  },
  bcr: {
    logoSrc: "/Logos/LogoBCR.png",
    shortLabel: "BCR",
    helper: "Cuenta bancaria",
    tone: "bg-gradient-to-br from-blue-500/15 to-blue-700/10 border-blue-400/35 shadow-lg shadow-blue-500/20",
    activeTone:
      "bg-gradient-to-br from-blue-500/25 to-blue-700/20 border-blue-300/70 shadow-xl shadow-blue-400/30",
  },
  bn: {
    logoSrc: "/Logos/LogoBN.webp",
    shortLabel: "BN",
    helper: "Cuenta bancaria",
    tone: "bg-gradient-to-br from-blue-500/15 to-blue-700/10 border-blue-400/35 shadow-lg shadow-blue-500/20",
    activeTone:
      "bg-gradient-to-br from-blue-500/25 to-blue-700/20 border-blue-300/70 shadow-xl shadow-blue-400/30",
  },
  bac: {
    logoSrc: "/Logos/LogoBAC.png",
    shortLabel: "BAC",
    helper: "Cuenta bancaria",
    tone: "bg-gradient-to-br from-blue-500/15 to-blue-700/10 border-blue-400/35 shadow-lg shadow-blue-500/20",
    activeTone:
      "bg-gradient-to-br from-blue-500/25 to-blue-700/20 border-blue-300/70 shadow-xl shadow-blue-400/30",
  },
  cajanegra: {
    icon: Archive,
    shortLabel: "Caja",
    helper: "Dineros extra",
    tone: "bg-gradient-to-br from-blue-500/15 to-blue-700/10 border-blue-400/35 shadow-lg shadow-blue-500/20",
    activeTone:
      "bg-gradient-to-br from-blue-500/25 to-blue-700/20 border-blue-300/70 shadow-xl shadow-blue-400/30",
  },
};

// Clave para persistir la selección del tab de cuenta en localStorage
const ACCOUNT_TAB_STORAGE_KEY = "fg_selected_account_tab";

export default function FondoPage() {
  const { user, loading } = useAuth();
  const [accountsSectionVisible, setAccountsSectionVisible] = useState(false);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const hasGeneralAccess = Boolean(permissions.fondogeneral);
  const availableTabs = useMemo<FondoTab[]>(() => {
    if (!hasGeneralAccess) return [];

    const list: FondoTab[] = [
      { id: "fondo", label: "Fondo General", namespace: "fg" },
    ];
    if (permissions.fondogeneralBCR)
      list.push({ id: "bcr", label: "Cuenta BCR", namespace: "bcr" });
    if (permissions.fondogeneralBN)
      list.push({ id: "bn", label: "Cuenta BN", namespace: "bn" });
    if (permissions.fondogeneralBAC)
      list.push({ id: "bac", label: "Cuenta BAC", namespace: "bac" });
    if (permissions.cajaNegra)
      list.push({ id: "cajanegra", label: "Caja Negra", namespace: "cn" });
    return list;
  }, [
    hasGeneralAccess,
    permissions.fondogeneralBCR,
    permissions.fondogeneralBN,
    permissions.fondogeneralBAC,
    permissions.cajaNegra,
  ]);

  const [active, setActiveState] = useState<TabId | "">(() => {
    if (typeof window === "undefined") return "fondo";
    try {
      const stored = localStorage.getItem(ACCOUNT_TAB_STORAGE_KEY);
      if (
        stored &&
        ["fondo", "bcr", "bn", "bac", "cajanegra"].includes(stored)
      ) {
        return stored as TabId;
      }
    } catch {
      // Ignorar errores de localStorage
    }
    return "fondo";
  });

  // Wrapper para guardar la selección del tab en localStorage
  const setActive = useCallback((tabId: TabId | "") => {
    setActiveState(tabId);
    if (typeof window === "undefined") return;
    try {
      if (tabId) {
        localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, tabId);
      } else {
        localStorage.removeItem(ACCOUNT_TAB_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error saving selected tab to localStorage:", error);
    }
  }, []);

  const [companySelectorSlot, setCompanySelectorSlot] =
    useState<React.ReactNode | null>(null);
  const [accountDockVisible, setAccountDockVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAccountsSectionVisible(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  const effectiveActive = useMemo<TabId | "">(() => {
    if (loading) return active;
    if (availableTabs.length === 0) return "";
    const exists = availableTabs.some((tab) => tab.id === active);
    return exists ? active : (availableTabs[0]?.id ?? "");
  }, [loading, active, availableTabs]);

  const activeTab = useMemo(() => {
    return availableTabs.find((tab) => tab.id === effectiveActive) || null;
  }, [availableTabs, effectiveActive]);

  const getCardEntranceStyle = useCallback((index: number) => {
    return {
      transitionDelay: `${Math.min(index * 70, 280)}ms`,
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;

    try {
      if (effectiveActive) {
        localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, effectiveActive);
      } else {
        localStorage.removeItem(ACCOUNT_TAB_STORAGE_KEY);
      }
    } catch {
      // Ignorar errores de localStorage
    }
  }, [effectiveActive, loading]);

  const handleCompanySelectorChange = useCallback(
    (node: React.ReactNode | null) => {
      setCompanySelectorSlot(node);
    },
    [],
  );

  useEffect(() => {
    const handleScroll = () => {
      setAccountDockVisible(window.scrollY > 360);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const handleAccountTabClick = useCallback(
    (tabId: TabId) => {
      if (tabId === effectiveActive) return;
      setActive(tabId);
    },
    [effectiveActive, setActive],
  );

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 lg:py-8">
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)] sm:text-base">
                Preparando Fondo General
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                Validando permisos y cuentas disponibles...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasGeneralAccess) {
    return (
      <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 lg:py-8">
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-center shadow-sm sm:p-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
            <ShieldAlert className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
            Acceso restringido
          </h3>
          <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)] sm:text-base">
            No tienes permisos para operar el Fondo General. Contacta a un
            administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 pb-28 shadow-sm sm:p-4 sm:pb-28 md:p-5 md:pb-28">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/10 p-2 sm:p-3">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 sm:h-14 sm:w-14">
                  <Coins className="h-6 w-6 text-[var(--accent)] sm:h-7 sm:w-7" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-[var(--foreground)] sm:text-2xl">
                      Fondo General
                    </h1>
                    {activeTab && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--input-border)] bg-[var(--muted)]/30 px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)]">
                        <Lock className="h-3.5 w-3.5" />
                        {activeTab.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                    Administra movimientos, saldos y cierres por cuenta con una
                    vista ordenada para el trabajo diario.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <div className="rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-2 text-center sm:min-w-[112px]">
                  <div className="text-lg font-semibold leading-none text-[var(--foreground)]">
                    {availableTabs.length}
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase text-[var(--muted-foreground)]">
                    Cuentas
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--input-border)] bg-[var(--muted)]/20 px-3 py-2 text-center sm:min-w-[112px]">
                  <div className="text-lg font-semibold leading-none text-[var(--foreground)]">
                    {activeTab ? TAB_VISUALS[activeTab.id].shortLabel : "-"}
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase text-[var(--muted-foreground)]">
                    Activa
                  </div>
                </div>
              </div>
            </div>

            {availableTabs.length > 0 && (
              <div
                className={`sticky top-2 z-30 flex min-w-0 max-w-full flex-col gap-3 rounded-xl border border-[var(--input-border)] bg-[#0f1519]/95 p-2 shadow-lg backdrop-blur-sm transition-all duration-700 ease-out motion-reduce:transition-none sm:p-3 lg:top-4 xl:flex-row xl:items-start xl:justify-between ${
                  accountsSectionVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3"
                }`}
              >
                <div
                  role="tablist"
                  aria-label="Cuentas"
                  className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain scroll-px-2 pb-2 lg:flex-wrap lg:overflow-visible lg:pb-0"
                >
                  {availableTabs.map((tab, index) => {
                    const isActive = effectiveActive === tab.id;
                    const visual = TAB_VISUALS[tab.id];
                    const Icon = visual.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        tabIndex={isActive ? 0 : -1}
                        aria-selected={isActive}
                        onClick={() => handleAccountTabClick(tab.id)}
                        style={getCardEntranceStyle(index)}
                        className={`group relative flex min-h-[68px] w-[230px] max-w-[calc(100vw-2.5rem)] flex-none items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-700 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] lg:min-w-[210px] lg:max-w-[260px] lg:flex-1 lg:basis-[210px] ${
                          accountsSectionVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-4"
                        } ${
                          isActive
                            ? "border-[var(--accent)] bg-[#131b21] text-[var(--foreground)] shadow-sm"
                            : "border-[var(--input-border)] bg-[#0e1418] text-[var(--muted-foreground)] hover:border-[var(--input-border)] hover:bg-[#141c21] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border ${
                            isActive ? visual.activeTone : visual.tone
                          }`}
                        >
                          {visual.logoSrc ? (
                            <img
                              src={visual.logoSrc}
                              alt={tab.label}
                              className="h-8 w-8 object-contain"
                              draggable={false}
                            />
                          ) : Icon ? (
                            <Icon className="h-5 w-5" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 pr-1">
                          <span className="block whitespace-normal text-sm font-semibold leading-tight">
                            {tab.label}
                          </span>
                          <span className="mt-0.5 block whitespace-normal text-xs leading-tight text-[var(--muted-foreground)]">
                            {visual.helper}
                          </span>
                        </span>
                        {isActive && (
                          <span className="absolute bottom-1 left-3 right-3 h-0.5 rounded-full bg-[var(--accent)]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {activeTab && companySelectorSlot && (
                  <div className="w-full min-w-0 xl:w-[380px] xl:flex-shrink-0">
                    <div className="min-w-0 rounded-lg border border-[var(--input-border)] bg-[#0c1216] p-2 sm:p-3">
                      {companySelectorSlot}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Contenido principal */}
        <div>
          {activeTab ? (
            <FondoSection
              namespace={activeTab.namespace}
              companySelectorPlacement="external"
              onCompanySelectorChange={handleCompanySelectorChange}
            />
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--muted)]/10 p-4 text-center sm:p-6">
              <p className="max-w-sm text-xs text-[var(--muted-foreground)] sm:text-sm">
                No hay cuentas disponibles para mostrar con tus permisos
                actuales.
              </p>
            </div>
          )}
        </div>
      </div>
      {availableTabs.length > 0 && (
        <div
          className={`fixed top-3 z-40 hidden rounded-xl border border-[var(--input-border)] bg-[#0b1115]/95 p-2 shadow-2xl shadow-black/35 backdrop-blur-md transition-all duration-300 ease-out md:left-4 md:right-4 md:block lg:left-[calc(var(--admin-sidebar-width)+1rem)] lg:right-4 ${
            accountDockVisible
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
          }`}
          aria-hidden={!accountDockVisible}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-2 xl:flex-row xl:items-center">
            <div
              role="tablist"
              aria-label="Acceso rapido a cuentas"
              className="flex min-w-0 flex-1 flex-wrap gap-2"
            >
              {availableTabs.map((tab) => {
                const isActive = effectiveActive === tab.id;
                const visual = TAB_VISUALS[tab.id];
                const Icon = visual.icon;
                return (
                  <button
                    key={`dock-${tab.id}`}
                    type="button"
                    role="tab"
                    tabIndex={accountDockVisible ? 0 : -1}
                    aria-selected={isActive}
                    onClick={() => handleAccountTabClick(tab.id)}
                    className={`group relative flex min-h-[48px] min-w-[132px] flex-1 basis-[132px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b1115] xl:max-w-[160px] ${
                      isActive
                        ? "border-[var(--accent)] bg-[#17232a] text-[var(--foreground)]"
                        : "border-[var(--input-border)] bg-[#0f171c] text-[var(--muted-foreground)] hover:bg-[#162027] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border ${
                        isActive ? visual.activeTone : visual.tone
                      }`}
                    >
                      {visual.logoSrc ? (
                        <img
                          src={visual.logoSrc}
                          alt={tab.label}
                          className="h-4 w-4 object-contain"
                          draggable={false}
                        />
                      ) : Icon ? (
                        <Icon className="h-3.5 w-3.5" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block whitespace-normal text-[13px] font-semibold leading-tight">
                        {tab.label}
                      </span>
                      <span className="mt-0.5 block whitespace-normal text-[10px] leading-tight text-[var(--muted-foreground)]">
                        {visual.helper}
                      </span>
                    </span>
                    {isActive && (
                      <span className="absolute bottom-1 left-3 right-3 h-0.5 rounded-full bg-[var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </div>
            {activeTab && companySelectorSlot && (
              <div className="w-full min-w-0 xl:w-[360px] xl:flex-shrink-0">
                <div className="max-h-[84px] min-w-0 overflow-y-auto rounded-lg border border-[var(--input-border)] bg-[#0c1216] p-2">
                  {companySelectorSlot}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
