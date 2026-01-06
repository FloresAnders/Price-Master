"use client";
import Image from "next/image";
import Fireworks from "fireworks-js";
import React, { useState, useEffect, useRef } from "react";
import {
  Scan,
  Calculator,
  Type,
  Banknote,
  Smartphone,
  Clock,
  Truck,
  Settings,
  History,
} from "lucide-react";
import AnimatedStickman from "../ui/AnimatedStickman";
import { User, UserPermissions } from "../../types/firestore";
import { getDefaultPermissions } from "../../utils/permissions";
import { useProviders } from "../../hooks/useProviders";

const menuItems = [
  {
    id: "scanner",
    name: "Escáner",
    icon: Scan,
    description: "Escanear códigos de barras",
    permission: "scanner" as keyof UserPermissions,
  },
  {
    id: "calculator",
    name: "Calculadora",
    icon: Calculator,
    description: "Calcular precios con descuentos",
    permission: "calculator" as keyof UserPermissions,
  },
  {
    id: "converter",
    name: "Conversor",
    icon: Type,
    description: "Convertir y transformar texto",
    permission: "converter" as keyof UserPermissions,
  },
  {
    id: "cashcounter",
    name: "Contador Efectivo",
    icon: Banknote,
    description: "Contar billetes y monedas (CRC/USD)",
    permission: "cashcounter" as keyof UserPermissions,
  },
  {
    id: "fondogeneral",
    name: "Fondo General",
    icon: Banknote,
    description: "Administrar el fondo general",
    permission: "fondogeneral" as keyof UserPermissions,
  },
  {
    id: "timingcontrol",
    name: "Control Tiempos",
    icon: Smartphone,
    description: "Registro de venta de tiempos",
    permission: "timingcontrol" as keyof UserPermissions,
  },
  {
    id: "controlhorario",
    name: "Control Horario",
    icon: Clock,
    description: "Registro de horarios de trabajo",
    permission: "controlhorario" as keyof UserPermissions,
  },
  {
    id: "calculohorasprecios",
    name: "Calculo horas precios",
    icon: Calculator,
    description: "Cálculo de horas y precios (planilla)",
    permission: "calculohorasprecios" as keyof UserPermissions,
  },
  {
    id: "supplierorders",
    name: "Órdenes Proveedor",
    icon: Truck,
    description: "Gestión de órdenes de proveedores",
    permission: "supplierorders" as keyof UserPermissions,
  },
  {
    id: "scanhistory",
    name: "Historial de Escaneos",
    icon: History,
    description: "Ver historial completo de escaneos",
    permission: "scanhistory" as keyof UserPermissions,
  },
  {
    id: "edit",
    name: "Mantenimiento",
    icon: Settings,
    description: "Gestión y mantenimiento del sistema",
    permission: "mantenimiento" as keyof UserPermissions,
  },
  {
    id: "solicitud",
    name: "Solicitud",
    icon: Type,
    description: "Solicitudes y trámites",
    permission: "solicitud" as keyof UserPermissions,
  },
];

interface HomeMenuProps {
  currentUser?: User | null;
}

export default function HomeMenu({ currentUser }: HomeMenuProps) {
  const [hovered, setHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showStickman, setShowStickman] = useState(false);
  const [showChristmasToast, setShowChristmasToast] = useState(false);
  const [showSupplierWeekInMenu, setShowSupplierWeekInMenu] = useState(false);

  const fireworksRef = useRef<HTMLDivElement>(null);
  const [fireworksInstance, setFireworksInstance] = useState<Fireworks | null>(
    null
  );

  // Resolve user permissions once for reuse
  const resolvedPermissions: UserPermissions | null = (() => {
    if (!currentUser) return null;
    return currentUser.permissions
      ? currentUser.permissions
      : getDefaultPermissions(currentUser.role || "user");
  })();

  // Filter menu items based on user permissions
  const getVisibleMenuItems = () => {
    if (!currentUser) {
      // If no user is logged in, show no items for security
      return [];
    }

    // Get user permissions or default permissions based on role
    let userPermissions: UserPermissions;
    if (currentUser.permissions) {
      userPermissions = currentUser.permissions;
    } else {
      // If no permissions are defined, use default permissions based on role
      userPermissions = getDefaultPermissions(currentUser.role || "user");
    }

    // Filter items based on user permissions
    return menuItems.filter((item) => {
      const hasPermission = userPermissions[item.permission];
      return hasPermission === true;
    });
  };

  const visibleMenuItems = getVisibleMenuItems();

  const hasSupplierWeekPermission = Boolean(
    resolvedPermissions?.supplierorders || resolvedPermissions?.fondogeneral
  );
  const canViewSupplierWeek = hasSupplierWeekPermission && showSupplierWeekInMenu;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readPreference = () => {
      const savedPreference = localStorage.getItem("show-supplier-week-menu");
      // Por defecto está desactivado (false)
      setShowSupplierWeekInMenu(savedPreference === "true");
    };

    readPreference();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "show-supplier-week-menu") readPreference();
    };

    const handlePrefChange = (e: Event) => {
      const key = (e as CustomEvent)?.detail?.key;
      if (key === "show-supplier-week-menu") readPreference();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("pricemaster:preference-change", handlePrefChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "pricemaster:preference-change",
        handlePrefChange
      );
    };
  }, []);

  const companyForProviders = (currentUser?.ownercompanie || "").trim();
  const {
    providers: weeklyProviders,
    loading: weeklyProvidersLoading,
    error: weeklyProvidersError,
  } = useProviders(canViewSupplierWeek ? companyForProviders : undefined);

  type VisitDay = "D" | "L" | "M" | "MI" | "J" | "V" | "S";
  const WEEK_DAY_CODES: VisitDay[] = ["D", "L", "M", "MI", "J", "V", "S"];
  const WEEK_DAY_LABELS: Record<VisitDay, string> = {
    D: "Domingo",
    L: "Lunes",
    M: "Martes",
    MI: "Miércoles",
    J: "Jueves",
    V: "Viernes",
    S: "Sábado",
  };

  const weekModel = (() => {
    const now = new Date();
    const todayKey = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    // Sunday-start
    start.setDate(start.getDate() - start.getDay());

    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(start);
      date.setDate(start.getDate() + idx);
      const code = WEEK_DAY_CODES[idx];
      const dateKey = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      ).getTime();
      return {
        idx,
        code,
        label: WEEK_DAY_LABELS[code],
        date,
        isToday: dateKey === todayKey,
      };
    });

    const visitProviders = (weeklyProviders || []).filter((p) => {
      const type = (p.type || "").toUpperCase();
      return type === "COMPRA INVENTARIO" && !!p.visit;
    });

    const createByCode = new Map<VisitDay, string[]>();
    const receiveByCode = new Map<VisitDay, string[]>();
    WEEK_DAY_CODES.forEach((c) => {
      createByCode.set(c, []);
      receiveByCode.set(c, []);
    });

    visitProviders.forEach((p) => {
      const name = p.name;
      const visit = p.visit;
      if (!visit) return;
      (visit.createOrderDays || []).forEach((d) => {
        const key = d as VisitDay;
        if (!createByCode.has(key)) return;
        createByCode.get(key)!.push(name);
      });
      (visit.receiveOrderDays || []).forEach((d) => {
        const key = d as VisitDay;
        if (!receiveByCode.has(key)) return;
        receiveByCode.get(key)!.push(name);
      });
    });

    const sortNames = (list: string[]) =>
      list
        .map((s) => s.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    WEEK_DAY_CODES.forEach((c) => {
      createByCode.set(c, sortNames(createByCode.get(c) || []));
      receiveByCode.set(c, sortNames(receiveByCode.get(c) || []));
    });

    return {
      days,
      createByCode,
      receiveByCode,
    };
  })();

  const handleNavigate = (id: string) => {
    if (typeof window !== "undefined") {
      // Redirigir a la ruta específica para la herramienta usando hash navigation
      window.location.hash = `#${id}`;
    }
  };

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    setHovered((h) => !h);

    if (newCount >= 5) {
      setShowStickman(true);
    }
  };

  // Mostrar fuegos artificiales automáticamente al ingresar al HomeMenu durante 6 segundos
  {
    /*useEffect(() => {
    if (fireworksRef.current && !fireworksInstance) {
      const fw = new Fireworks(fireworksRef.current);
      fw.start();
      setFireworksInstance(fw);

      const timer = setTimeout(() => {
        fw.stop();
        setFireworksInstance(null);
      }, 86400); // 6 segundos

      return () => clearTimeout(timer);
    }
  }, []); // Se ejecuta solo al montar el componente
  */
  }

  // Ocultar el AnimatedStickman después de 10 segundos
  useEffect(() => {
    if (showStickman) {
      const timer = setTimeout(() => {
        setShowStickman(false);
      }, 10000); // 10 segundos

      return () => clearTimeout(timer);
    }
  }, [showStickman]);

  // Mostrar el toast al entrar y ocultarlo a los 5 segundos
  useEffect(() => {
    setShowChristmasToast(true);
    const timer = setTimeout(() => {
      setShowChristmasToast(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <div
        ref={fireworksRef}
        className="fixed inset-0 pointer-events-none z-40"
      />
      <div className="mb-2 flex items-center justify-center relative">
        <Image
          src="/Logos/LogoBlanco2.png"
          alt="Time Master logo"
          className={`w-28 h-28 mr-2 transition-transform duration-300 ${
            hovered ? "scale-110 rotate-12" : "scale-100"
          }`}
          width={56}
          height={56}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleLogoClick}
          style={{
            cursor: "pointer",
            filter: hovered ? "drop-shadow(0 0 8px var(--foreground))" : "none",
          }}
        />
      </div>
      <h1 className="text-3xl font-bold mb-8 text-center">
        {currentUser
          ? `¡Qué gusto verte, ${
              currentUser.name ?? currentUser.email ?? "Usuario"
            } !`
          : "¡Qué gusto verte!"}
      </h1>

      {visibleMenuItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-8 max-w-md mx-auto">
            <Settings className="w-16 h-16 mx-auto mb-4 text-[var(--primary)]" />
            <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)]">
              Sin herramientas disponibles
            </h3>
            <p className="text-[var(--muted-foreground)] mb-4">
              No tienes permisos para acceder a ninguna herramienta en este
              momento.
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Contacta a tu administrador para obtener acceso a las
              funcionalidades que necesitas.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-screen-xl pt-4">
          {canViewSupplierWeek && (
            <div
              className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4"
              style={{ minHeight: 160 }}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    Semana actual (proveedores)
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Crea pedido y recibe pedido (Domingo a Sábado)
                  </p>
                </div>
              </div>

              {!companyForProviders ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  No se pudo determinar la empresa del usuario.
                </div>
              ) : weeklyProvidersLoading ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  Cargando proveedores...
                </div>
              ) : weeklyProvidersError ? (
                <div className="text-sm text-red-500">
                  {weeklyProvidersError}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {weekModel.days.map((d) => {
                    const createList = weekModel.createByCode.get(d.code) || [];
                    const receiveList = weekModel.receiveByCode.get(d.code) || [];
                    const hasAny = createList.length > 0 || receiveList.length > 0;
                    const todayStyle = d.isToday
                      ? {
                          borderColor: "var(--success)",
                          backgroundColor:
                            "color-mix(in srgb, var(--success) 18%, var(--card-bg))",
                        }
                      : undefined;

                    return (
                      <div
                        key={`week-${d.code}`}
                        className="rounded-lg border border-[var(--input-border)] p-2 bg-[var(--muted)]"
                        style={todayStyle}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-xs font-semibold text-[var(--foreground)]">
                            {d.code}
                          </div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">
                            {d.date.getDate()}/{d.date.getMonth() + 1}
                          </div>
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)] mb-2">
                          {d.label}
                        </div>

                        {!hasAny ? (
                          <div className="text-[10px] text-[var(--muted-foreground)]">
                            Sin visitas
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {createList.length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-[var(--foreground)]">
                                  Crear
                                </div>
                                <div className="text-[10px] text-[var(--muted-foreground)] break-words">
                                  {createList.join(", ")}
                                </div>
                              </div>
                            )}
                            {receiveList.length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-[var(--foreground)]">
                                  Recibir
                                </div>
                                <div className="text-[10px] text-[var(--muted-foreground)] break-words">
                                  {receiveList.join(", ")}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {visibleMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className="bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 flex flex-col items-center transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] group"
              style={{ minHeight: 160 }}
            >
              <item.icon className="w-10 h-10 mb-3 text-[var(--primary)] group-hover:scale-110 group-hover:text-[var(--button-hover)] transition-all" />
              <span className="text-lg font-semibold mb-1 text-[var(--foreground)] dark:text-[var(--foreground)]">
                {item.name}
              </span>
              <span className="text-sm text-[var(--muted-foreground)] text-center">
                {item.description}
              </span>
              {/* No badge shown here; navigation goes to the Fondo General page */}
            </button>
          ))}
        </div>
      )}

      {/* AnimatedStickman aparece solo después de 5 clicks */}
      {showStickman && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <AnimatedStickman />
        </div>
      )}
    </div>
  );
}
