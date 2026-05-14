"use client";

import {
  X,
  Settings,
  User,
  Shield,
  Timer,
  TimerOff,
  LogOut,
  Calculator,
  GripVertical,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import TokenInfo from "../session/TokenInfo";

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  showSessionTimer: boolean;
  onToggleSessionTimer: (show: boolean) => void;
  showCalculator: boolean;
  onToggleCalculator: (show: boolean) => void;
  showSupplierWeekInMenu: boolean;
  onToggleSupplierWeekInMenu: (show: boolean) => void;
  enableHomeMenuSortMobile: boolean;
  onToggleHomeMenuSortMobile: (enabled: boolean) => void;
  onLogoutClick: () => void;
}

export default function ConfigurationModal({
  isOpen,
  onClose,
  showSessionTimer,
  onToggleSessionTimer,
  showCalculator,
  onToggleCalculator,
  showSupplierWeekInMenu,
  onToggleSupplierWeekInMenu,
  enableHomeMenuSortMobile,
  onToggleHomeMenuSortMobile,
  onLogoutClick,
}: ConfigurationModalProps) {
  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-slate-100 flex items-center gap-3">
              <Settings className="w-6 h-6 text-cyan-400" />
              Configuración del Sistema
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* User Information */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Información del Usuario
            </h3>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-8 h-8 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-200">
                    {user?.name}
                  </div>
                  <div className="text-sm text-slate-400">
                    Usuario activo: <strong>{user?.name}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Management */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-slate-100 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              Gestión de Sesión
            </h3>
            <div className="space-y-4">
              <TokenInfo isOpen={true} onClose={() => {}} inline={true} />

              {/* Toggle para FloatingSessionTimer */}
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {showSessionTimer ? (
                      <Timer className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <TimerOff className="w-5 h-5 text-slate-500" />
                    )}
                    <div>
                      <div className="font-medium text-slate-200">
                        Temporizador Flotante
                      </div>
                      <div className="text-sm text-slate-400">
                        {showSessionTimer ? "Visible en pantalla" : "Oculto"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showSessionTimer}
                        onChange={(e) => onToggleSessionTimer(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                          showSessionTimer
                            ? "bg-cyan-600 shadow-lg"
                            : "bg-slate-600"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                          showSessionTimer ? "translate-x-6" : "translate-x-0"
                        }`}
                      ></div>
                    </div>
                  </label>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {showSessionTimer
                    ? "El temporizador de sesión se muestra en la esquina inferior derecha"
                    : "Activa para mostrar el temporizador de sesión flotante"}
                </div>
              </div>

              {/* Toggle para Calculadora Siempre Visible */}
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calculator
                      className={`w-5 h-5 ${showCalculator ? "text-cyan-400" : "text-slate-500"}`}
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Mostrar Siempre la Calculadora
                      </div>
                      <div className="text-sm text-slate-400">
                        {showCalculator
                          ? "Calculadora visible en todas las páginas"
                          : "Calculadora oculta"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showCalculator}
                        onChange={(e) => onToggleCalculator(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                          showCalculator
                            ? "bg-cyan-600 shadow-lg"
                            : "bg-slate-600"
                        }`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                          showCalculator ? "translate-x-6" : "translate-x-0"
                        }`}
                      ></div>
                    </div>
                  </label>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {showCalculator
                    ? "La calculadora estará disponible en todas las páginas como botón flotante"
                    : "Activa para mostrar la calculadora flotante en toda la aplicación"}
                </div>
              </div>

              {/* Toggle para mostrar/ocultar tarjeta semanal de proveedores en Home */}
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Settings
                      className={`w-5 h-5 ${showSupplierWeekInMenu ? "text-cyan-400" : "text-slate-500"}`}
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Mostrar en menu la tarjeta de Semana Proveedores
                      </div>
                      <div className="text-sm text-slate-400">
                        {showSupplierWeekInMenu
                          ? "Tarjeta visible en el Home (si tienes permisos)"
                          : "Tarjeta oculta en el Home"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showSupplierWeekInMenu}
                        onChange={(e) =>
                          onToggleSupplierWeekInMenu(e.target.checked)
                        }
                        className="sr-only"
                      />
                      <div
                        className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                          showSupplierWeekInMenu
                            ? "bg-cyan-600 shadow-lg"
                            : "bg-slate-600"
                        }`}
                      />
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                          showSupplierWeekInMenu
                            ? "translate-x-6"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {showSupplierWeekInMenu
                    ? "Se muestra la tarjeta de Semana actual (proveedores) en el menú principal"
                    : "Activa para mostrar la tarjeta semanal de proveedores en el Home"}
                </div>
              </div>

              {/* Toggle para habilitar ordenar el menú del Home */}
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical
                      className={`w-5 h-5 ${enableHomeMenuSortMobile ? "text-cyan-400" : "text-slate-500"}`}
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Ordenar menú
                      </div>
                      <div className="text-sm text-slate-400">
                        {enableHomeMenuSortMobile
                          ? "Arrastra para reordenar las tarjetas del Home"
                          : "Desactivado para evitar toques accidentales"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={enableHomeMenuSortMobile}
                        onChange={(e) =>
                          onToggleHomeMenuSortMobile(e.target.checked)
                        }
                        className="sr-only"
                      />
                      <div
                        className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                          enableHomeMenuSortMobile
                            ? "bg-cyan-600 shadow-lg"
                            : "bg-slate-600"
                        }`}
                      />
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                          enableHomeMenuSortMobile
                            ? "translate-x-6"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Aplica en todas las pantallas.
                </div>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-medium text-slate-100 mb-4">
              Acciones
            </h3>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900/80 hover:border-white/20"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  onClose();
                  onLogoutClick();
                }}
                className="flex items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/20 hover:border-red-400/40"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
