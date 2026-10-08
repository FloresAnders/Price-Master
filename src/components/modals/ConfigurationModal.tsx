"use client";

import { useState } from "react";
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
  Banknote,
  BellRing,
  BellOff,
  ChevronDown,
  ClipboardList,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import useToast from "../../hooks/useToast";
import TokenInfo from "../session/TokenInfo";
import { canConfigureSinpeNotifications } from "../sinpe/sinpeNotificationPreference";
import { useSessionListenerPreferences } from "@/contexts/SessionListenerPreferencesContext";
import type { SessionListenerPreferenceKey } from "@/services/layoutPrefsDb";

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  showSessionTimer: boolean;
  onToggleSessionTimer: (show: boolean) => void;
  showCalculator: boolean;
  onToggleCalculator: (show: boolean) => void;
  showCashCounterFloating: boolean;
  onToggleCashCounterFloating: (show: boolean) => void;
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
  showCashCounterFloating,
  onToggleCashCounterFloating,
  showSupplierWeekInMenu,
  onToggleSupplierWeekInMenu,
  enableHomeMenuSortMobile,
  onToggleHomeMenuSortMobile,
  onLogoutClick,
}: ConfigurationModalProps) {
  const { user, updateCurrentUser } = useAuth();
  const {
    preferences: sessionListenerPreferences,
    loaded: sessionListenerPreferencesLoaded,
    setPreference: setSessionListenerPreference,
  } = useSessionListenerPreferences();
  const { showToast } = useToast();
  const [sessionPermissionsOpen, setSessionPermissionsOpen] = useState(false);
  const [savingSessionPreference, setSavingSessionPreference] =
    useState<SessionListenerPreferenceKey | null>(null);
  const [savingSinpeNotifications, setSavingSinpeNotifications] =
    useState(false);
  const canConfigureSinpe = canConfigureSinpeNotifications(user?.role);
  const sinpeNotificationsPreferenceLoaded =
    !canConfigureSinpe || user?.sinpeNotificationsPreferenceLoaded === true;
  const sinpeNotificationsEnabled =
    sinpeNotificationsPreferenceLoaded &&
    user?.sinpeNotificationsEnabled !== false;

  const updateSinpeNotificationPreference = async (enabled: boolean) => {
    if (
      !canConfigureSinpe ||
      !sinpeNotificationsPreferenceLoaded ||
      savingSinpeNotifications
    ) {
      return;
    }
    setSavingSinpeNotifications(true);
    try {
      const response = await fetch("/api/users/sinpe-notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error("sinpe_notification_preference_failed");
      }
      const payload = (await response.json()) as {
        sinpeNotificationsEnabled?: unknown;
      };
      if (typeof payload.sinpeNotificationsEnabled !== "boolean") {
        throw new Error("sinpe_notification_preference_invalid_response");
      }
      updateCurrentUser({
        sinpeNotificationsEnabled: payload.sinpeNotificationsEnabled,
        sinpeNotificationsPreferenceLoaded: true,
      });
      showToast(
        enabled
          ? "Notificaciones SINPE activadas"
          : "Notificaciones SINPE desactivadas",
        "success",
      );
    } catch {
      showToast(
        "No se pudo guardar la preferencia de notificaciones SINPE",
        "error",
      );
    } finally {
      setSavingSinpeNotifications(false);
    }
  };

  const updateSessionListenerPreference = async (
    preference: SessionListenerPreferenceKey,
    enabled: boolean,
  ) => {
    if (!sessionListenerPreferencesLoaded || savingSessionPreference) return;
    setSavingSessionPreference(preference);
    try {
      await setSessionListenerPreference(preference, enabled);
      showToast(
        enabled ? "Listener de sesión activado" : "Listener de sesión desactivado",
        "success",
      );
    } catch {
      showToast("No se pudo guardar el permiso de sesión", "error");
    } finally {
      setSavingSessionPreference(null);
    }
  };

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

              <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/50">
                <button
                  type="button"
                  aria-expanded={sessionPermissionsOpen}
                  aria-controls="session-listener-permissions"
                  onClick={() => setSessionPermissionsOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <div>
                    <div className="font-medium text-slate-200">
                      Permisos de sesión
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Controla conexiones en tiempo real de esta sesión.
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                      sessionPermissionsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {sessionPermissionsOpen && (
                  <div
                    id="session-listener-permissions"
                    className="space-y-3 border-t border-white/10 p-4"
                  >
                    {([
                      {
                        key: "pendingCompanyRequests" as const,
                        title: "Solicitudes pendientes de la empresa",
                        description:
                          "Escucha solicitudes nuevas y muestra indicador y sonido en tiempo real.",
                        Icon: ClipboardList,
                      },
                      {
                        key: "chatReadMuteState" as const,
                        title: "Estado de lectura/silencio del chat",
                        description:
                          "Sincroniza mensajes leídos, contador pendiente y silencio del chat.",
                        Icon: MessageCircle,
                      },
                    ] satisfies Array<{
                      key: SessionListenerPreferenceKey;
                      title: string;
                      description: string;
                      Icon: typeof ClipboardList;
                    }>).map(({ key, title, description, Icon }) => {
                      const enabled = sessionListenerPreferences[key];
                      const saving = savingSessionPreference === key;
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-white/10 bg-slate-950/50 p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <Icon
                                className={`h-5 w-5 shrink-0 ${
                                  enabled ? "text-cyan-400" : "text-slate-500"
                                }`}
                              />
                              <div className="font-medium text-slate-200">
                                {title}
                              </div>
                            </div>
                            <label
                              className={`flex shrink-0 items-center ${
                                saving || !sessionListenerPreferencesLoaded
                                  ? "cursor-wait opacity-60"
                                  : "cursor-pointer"
                              }`}
                            >
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  aria-label={title}
                                  checked={enabled}
                                  disabled={
                                    saving || !sessionListenerPreferencesLoaded
                                  }
                                  onChange={(event) =>
                                    void updateSessionListenerPreference(
                                      key,
                                      event.target.checked,
                                    )
                                  }
                                  className="sr-only"
                                />
                                <div
                                  className={`block h-6 w-12 rounded-full transition-colors ${
                                    enabled ? "bg-cyan-600" : "bg-slate-600"
                                  }`}
                                />
                                <div
                                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                    enabled ? "translate-x-6" : "translate-x-0"
                                  }`}
                                />
                              </div>
                            </label>
                          </div>
                          <p className="mt-3 text-xs text-slate-400">
                            {!sessionListenerPreferencesLoaded
                              ? "Cargando preferencia..."
                              : description}
                          </p>
                        </div>
                      );
                    })}
                    <p className="text-xs text-slate-500">
                      Desactivados por defecto. Preferencias guardadas en este navegador.
                    </p>
                  </div>
                )}
              </div>

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

              {canConfigureSinpe && (
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {sinpeNotificationsEnabled ? (
                        <BellRing className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <BellOff className="h-5 w-5 text-slate-500" />
                      )}
                      <div>
                        <div className="font-medium text-slate-200">
                          Notificaciones SINPE
                        </div>
                        <div className="text-sm text-slate-400">
                          {!sinpeNotificationsPreferenceLoaded
                            ? "Cargando preferencia..."
                            : sinpeNotificationsEnabled
                              ? "Recibir avisos de nuevos SINPE"
                              : "Avisos de SINPE desactivados"}
                        </div>
                      </div>
                    </div>
                    <label
                      className={`flex items-center ${
                        savingSinpeNotifications ||
                        !sinpeNotificationsPreferenceLoaded
                          ? "cursor-wait opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          aria-label="Recibir notificaciones SINPE"
                          checked={sinpeNotificationsEnabled}
                          disabled={
                            savingSinpeNotifications ||
                            !sinpeNotificationsPreferenceLoaded
                          }
                          onChange={(event) =>
                            void updateSinpeNotificationPreference(
                              event.target.checked,
                            )
                          }
                          className="sr-only"
                        />
                        <div
                          className={`block h-6 w-12 rounded-full transition-colors duration-200 ease-in-out ${
                            sinpeNotificationsEnabled
                              ? "bg-emerald-600 shadow-lg"
                              : "bg-slate-600"
                          }`}
                        />
                        <div
                          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                            sinpeNotificationsEnabled
                              ? "translate-x-6"
                              : "translate-x-0"
                          }`}
                        />
                      </div>
                    </label>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Esta preferencia se guarda para tu usuario en todos tus
                    dispositivos.
                  </div>
                </div>
              )}

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

              {/* Toggle para Contador de Efectivo Siempre Visible */}
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Banknote
                      className={`w-5 h-5 ${showCashCounterFloating ? "text-cyan-400" : "text-slate-500"}`}
                    />
                    <div>
                      <div className="font-medium text-slate-200">
                        Mostrar Siempre el Contador de Efectivo
                      </div>
                      <div className="text-sm text-slate-400">
                        {showCashCounterFloating
                          ? "Contador disponible como botÃ³n flotante"
                          : "Contador flotante oculto"}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showCashCounterFloating}
                        onChange={(e) =>
                          onToggleCashCounterFloating(e.target.checked)
                        }
                        className="sr-only"
                      />
                      <div
                        className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                          showCashCounterFloating
                            ? "bg-cyan-600 shadow-lg"
                            : "bg-slate-600"
                        }`}
                      />
                      <div
                        className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                          showCashCounterFloating
                            ? "translate-x-6"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {showCashCounterFloating
                    ? "Abre el contador de efectivo en un modal desde cualquier secciÃ³n"
                    : "Activa para mostrar el contador flotante en toda la aplicaciÃ³n"}
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
