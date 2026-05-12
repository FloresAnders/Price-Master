// app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";
/*import { Calculator, Smartphone, Type, Banknote, Scan, Clock, Truck, Settings, History, } from lucide-react'*/
import { ClientOnlyHomeMenu } from "@/components/layout";
import Pruebas from "@/components/xpruebas/Pruebas";
import { safeWindow } from "@/utils/client";

// Dynamic imports for code splitting
const BarcodeScanner = dynamic(
  () =>
    import("@/components/scanner").then((mod) => ({
      default: mod.BarcodeScanner,
    })),
  { ssr: false },
);
const PriceCalculator = dynamic(
  () =>
    import("@/components/calculator").then((mod) => ({
      default: mod.PriceCalculator,
    })),
  { ssr: false },
);
const TextConversion = dynamic(
  () =>
    import("@/components/calculator").then((mod) => ({
      default: mod.TextConversion,
    })),
  { ssr: false },
);
const CashCounterTabs = dynamic(
  () =>
    import("@/components/business").then((mod) => ({
      default: mod.CashCounterTabs,
    })),
  { ssr: false },
);
const ControlHorario = dynamic(
  () =>
    import("@/components/business").then((mod) => ({
      default: mod.ControlHorario,
    })),
  { ssr: false },
);
const TimingControl = dynamic(
  () =>
    import("@/components/business").then((mod) => ({
      default: mod.TimingControl,
    })),
  { ssr: false },
);
const CalculoHorasPrecios = dynamic(
  () =>
    import("@/components/business").then((mod) => ({
      default: mod.CalculoHorasPrecios,
    })),
  { ssr: false },
);
const EmpleadosProximamente = dynamic(
  () =>
    import("@/components/business").then((mod) => ({
      default: mod.EmpleadosProximamente,
    })),
  { ssr: false },
);
const SupplierOrders = dynamic(
  () =>
    import("@/components/business").then((mod) => ({
      default: mod.SupplierOrders,
    })),
  { ssr: false },
);
const Mantenimiento = dynamic(
  () =>
    import("@/components/admin").then((mod) => ({
      default: mod.Mantenimiento,
    })),
  { ssr: false },
);
const FuncionesTab = dynamic(
  () =>
    import("@/components/funciones/FuncionesTab").then((mod) => ({
      default: mod.FuncionesTab,
    })),
  { ssr: false },
);
const FondoPage = dynamic(
  () => import("@/app/fondogeneral/fondogeneral/page"),
  { ssr: false },
);
const AgregarProveedorPage = dynamic(
  () => import("@/app/fondogeneral/agregarproveedor/page"),
  { ssr: false },
);
const ReportesPage = dynamic(() => import("@/app/fondogeneral/otra/page"), {
  ssr: false,
});
const ConfiguracionFondoGeneralPage = dynamic(
  () => import("@/app/fondogeneral/configuracion/page"),
  { ssr: false },
);
const SolicitudForm = dynamic(
  () => import("@/components/solicitud/SolicitudForm"),
  { ssr: false },
);
const XmlPage = dynamic(() => import("@/components/xml/XmlPage"), {
  ssr: false,
});
const RecetasTab = dynamic(
  () =>
    import("../components/recetas/RecetasTab").then((mod) => ({
      default: mod.RecetasTab,
    })),
  { ssr: false },
);
const AgregarProductoTab = dynamic(
  () =>
    import("../components/recetas/AgregarProductoTab").then((mod) => ({
      default: mod.AgregarProductoTab,
    })),
  { ssr: false },
);

// 1) Ampliamos ActiveTab para incluir "cashcounter", "controlhorario", "supplierorders", "edit", "scanhistory", "solicitud", "agregarproveedor", "reportes"
type ActiveTab =
  | "scanner"
  | "calculator"
  | "converter"
  | "xml"
  | "cashcounter"
  | "recetas"
  | "agregarproducto"
  | "timingcontrol"
  | "controlhorario"
  | "empleados"
  | "funciones"
  | "calculohorasprecios"
  | "supplierorders"
  | "scanhistory"
  | "edit"
  | "solicitud"
  | "fondogeneral"
  | "agregarproveedor"
  | "reportes"
  | "configuracion"
  | "pruebas";

export default function HomePage() {
  // Hook para obtener el usuario autenticado
  const { user } = useAuth();

  // 2) Estado para la pestaña activa - now managed by URL hash only
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  // Helper function to get tab info

  const isSuperAdmin = user?.role === "superadmin";

  // 4) Al montar, leemos el hash de la URL y marcamos la pestaña correspondiente
  useEffect(() => {
    const checkAndSetTab = () => {
      if (typeof window !== "undefined") {
        const hash = safeWindow.location
          .getHash()
          .replace("#", "") as ActiveTab;

        if (hash === "pruebas" && !isSuperAdmin) {
          safeWindow.location.hash("");
          setActiveTab(null);
          return;
        }

        const validTabs = [
          "scanner",
          "calculator",
          "converter",
          "xml",
          "cashcounter",
          "recetas",
          "agregarproducto",
          "timingcontrol",
          "controlhorario",
          "empleados",
          "funciones",
          "calculohorasprecios",
          "supplierorders",
          "scanhistory",
          "solicitud",
          "fondogeneral",
          "agregarproveedor",
          "reportes",
          "configuracion",
          ...(isSuperAdmin ? ["pruebas"] : []),
        ];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else if (hash === "edit") {
          // Special handling for edit tab
          setActiveTab("edit");
        } else {
          setActiveTab(null); // Si no hay hash válido, mostrar HomeMenu
        }
      }
    };
    checkAndSetTab();
    const timeout = setTimeout(checkAndSetTab, 100);
    return () => clearTimeout(timeout);
  }, [isSuperAdmin]);

  // 6) Escuchar cambios en el hash para actualizar la pestaña activa
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleHashChange = () => {
        const hash = safeWindow.location
          .getHash()
          .replace("#", "") as ActiveTab;

        if (hash === "pruebas" && !isSuperAdmin) {
          safeWindow.location.hash("");
          setActiveTab(null);
          return;
        }

        const validTabs = [
          "scanner",
          "calculator",
          "converter",
          "xml",
          "cashcounter",
          "recetas",
          "agregarproducto",
          "timingcontrol",
          "controlhorario",
          "empleados",
          "funciones",
          "calculohorasprecios",
          "supplierorders",
          "scanhistory",
          "edit",
          "solicitud",
          "fondogeneral",
          "agregarproveedor",
          "reportes",
          "configuracion",
          ...(isSuperAdmin ? ["pruebas"] : []),
        ];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab(null);
        }
      };
      window.addEventListener("hashchange", handleHashChange);
      return () => {
        window.removeEventListener("hashchange", handleHashChange);
      };
    }
  }, [isSuperAdmin]);
  return (
    <>
      <div className="flex-1 max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* notifications are rendered globally by ToastProvider */}
        {activeTab === null ? (
          <ClientOnlyHomeMenu />
        ) : (
          <>
            {/*TODO: DESCOMENTAR LO SIGUIENTE SI SE QUIERE LAS DESCRIPCIONES EN LAS PESTAÑAS */}
            {/* Page title for active tab 
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold mb-2">
                {getTabInfo(activeTab)?.name}
              </h2>
              <p className="text-[var(--tab-text)]">
                {getTabInfo(activeTab)?.description}
              </p>
            </div>*/}

            {/* Contenido de las pestañas */}
            <div className="space-y-8">
              {/* SCANNER */}
              {activeTab === "scanner" && (
                <div className="w-full">
                  <BarcodeScanner />
                </div>
              )}

              {/* CALCULATOR */}
              {activeTab === "calculator" && <PriceCalculator />}

              {/* CONVERTER */}
              {activeTab === "converter" && <TextConversion />}

              {/* XML */}
              {activeTab === "xml" && <XmlPage />}

              {/* CASHCOUNTER (Contador Efectivo) */}
              {activeTab === "cashcounter" && <CashCounterTabs />}

              {activeTab === "recetas" && <RecetasTab />}
              {activeTab === "agregarproducto" && <AgregarProductoTab />}

              {/* CONTROL TIEMPOS */}
              {activeTab === "timingcontrol" && (
                <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
                  <TimingControl />
                </div>
              )}

              {/* CONTROL HORARIO */}
              {activeTab === "controlhorario" && (
                <ControlHorario currentUser={user} />
              )}

              {/* EMPLEADOS (próximamente) */}
              {activeTab === "empleados" && <EmpleadosProximamente />}

              {/* FUNCIONES */}
              {activeTab === "funciones" && <FuncionesTab />}

              {/* CALCULO HORAS PRECIOS */}
              {activeTab === "calculohorasprecios" && <CalculoHorasPrecios />}

              {/* SUPPLIER ORDERS */}
              {activeTab === "supplierorders" && <SupplierOrders />}

              {/* FONDO GENERAL */}
              {activeTab === "fondogeneral" && <FondoPage />}

              {/* AGREGAR PROVEEDOR */}
              {activeTab === "agregarproveedor" && <AgregarProveedorPage />}

              {/* REPORTES */}
              {activeTab === "reportes" && <ReportesPage />}

              {/* CONFIGURACION */}
              {activeTab === "configuracion" && (
                <ConfiguracionFondoGeneralPage />
              )}

              {/* SOLICITUD */}
              {activeTab === "solicitud" && <SolicitudForm />}

              {/* EDIT / MANTENIMIENTO */}
              {activeTab === "edit" && <Mantenimiento />}

              {/* ÁREA DE PRUEBAS */}
              {activeTab === "pruebas" && isSuperAdmin && <Pruebas />}
            </div>
          </>
        )}
      </div>
    </>
  );
}
