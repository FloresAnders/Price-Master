'use client'

import Image from 'next/image';
import { Settings, LogOut, Menu, X, Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, History, User, ChevronDown, Shield, Timer, TimerOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { getDefaultPermissions } from '../utils/permissions';
import TokenInfo from './TokenInfo';
import FloatingSessionTimer from './FloatingSessionTimer';
import type { UserPermissions } from '../types/firestore';

type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'timingcontrol' | 'controlhorario' | 'supplierorders' | 'histoscans' | 'scanhistory' | 'edit'

interface HeaderProps {
  activeTab?: ActiveTab | null;
  onTabChange?: (tab: ActiveTab | null) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const { logout, user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [showSessionTimer, setShowSessionTimer] = useState(false);

  // Ensure component is mounted on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Cargar preferencia del FloatingSessionTimer desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPreference = localStorage.getItem('show-session-timer');
      // Por defecto está desactivado (false)
      setShowSessionTimer(savedPreference === 'true');
    }
  }, []);

  // Guardar preferencia del FloatingSessionTimer cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('show-session-timer', showSessionTimer.toString());
    }
  }, [showSessionTimer]);

  // Close dropdown on scroll or resize
  useEffect(() => {
    if (!showUserDropdown) return;

    const handleScrollOrResize = () => {
      setShowUserDropdown(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showUserDropdown]);

  // Close config modal with ESC key
  useEffect(() => {
    if (!showConfigModal) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowConfigModal(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showConfigModal]);

  // Navigation tabs with permissions
  const allTabs = [
    { id: 'scanner' as ActiveTab, name: 'Escáner', icon: Scan, description: 'Escanear códigos de barras', permission: 'scanner' as keyof UserPermissions },
    { id: 'calculator' as ActiveTab, name: 'Calculadora', icon: Calculator, description: 'Calcular precios con descuentos', permission: 'calculator' as keyof UserPermissions },
    { id: 'converter' as ActiveTab, name: 'Conversor', icon: Type, description: 'Convertir y transformar texto', permission: 'converter' as keyof UserPermissions },
    {
      id: 'cashcounter' as ActiveTab,
      name: 'Contador Efectivo',
      icon: Banknote,
      description: 'Contar billetes y monedas (CRC/USD)',
      permission: 'cashcounter' as keyof UserPermissions
    },
    { id: 'timingcontrol' as ActiveTab, name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos', permission: 'timingcontrol' as keyof UserPermissions },
    { id: 'controlhorario' as ActiveTab, name: 'Control Horario', icon: Clock, description: 'Registro de horarios de trabajo', permission: 'controlhorario' as keyof UserPermissions },
    { id: 'supplierorders' as ActiveTab, name: 'Órdenes Proveedor', icon: Truck, description: 'Gestión de órdenes de proveedores', permission: 'supplierorders' as keyof UserPermissions },
    { id: 'edit' as ActiveTab, name: 'Mantenimiento', icon: Settings, description: 'Gestión y mantenimiento del sistema', permission: 'mantenimiento' as keyof UserPermissions },
    { id: 'histoscans' as ActiveTab, name: 'Historial de Escaneos', icon: History, description: 'Ver historial de escaneos realizados', permission: 'scanhistory' as keyof UserPermissions },
  ];

  // Get user permissions or default if not available
  const userPermissions = user?.permissions || getDefaultPermissions(user?.role);

  // Filter tabs based on user permissions
  const visibleTabs = allTabs.filter(tab => {
    const hasPermission = userPermissions[tab.permission];
    return hasPermission;
  });

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoClick = () => {
    if (!isClient) return;
    
    // Redirigir a la página principal
    window.location.href = '/';
  };

  const handleTabClick = (tabId: ActiveTab) => {
    if (!isClient) return;
    
    // Para todas las páginas, usar hash normal
    onTabChange?.(tabId);
    const hashId = tabId === 'histoscans' ? 'scanhistory' : tabId;
    window.location.hash = `#${hashId}`;
  };

  const handleUserDropdownClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!showUserDropdown) {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap below button
        right: window.innerWidth - rect.right // Distance from right edge
      });
    }
    setShowUserDropdown(!showUserDropdown);
  };

  const handleConfirmLogout = async () => {
    if (!isClient) return;
    
    try {
      await logout();
      // Regresar al inicio después del logout
      window.location.href = '/';
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <>
      <header className="w-full border-b border-[var(--input-border)] bg-transparent backdrop-blur-sm relative overflow-hidden">
        {/* Main header row */}
        <div className="flex items-center justify-between p-4" suppressHydrationWarning>
          {/* Logo and title */}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-3 text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--tab-text-active)] transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            <Image
              src="/favicon-32x32.png"
              alt="Price Master Logo"
              width={32}
              height={32}
              className="rounded"
            />
            Price Master
          </button>

          {/* Desktop navigation tabs - only show when inside a card */}
          {activeTab && visibleTabs.length > 0 && (
            <nav className="hidden lg:flex items-center gap-1">
              {visibleTabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-[var(--tab-text-active)] font-semibold'
                        : 'text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:bg-[var(--hover-bg)]'
                    }`}
                    title={tab.description}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="hidden xl:inline">{tab.name}</span>
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--tab-text-active)] rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-2" suppressHydrationWarning>
            {/* User dropdown menu */}
            {user && (
              <div className="hidden md:flex items-center gap-2">
                {/* User button with dropdown */}
                <div className="relative" style={{ zIndex: 'auto' }}>
                  <button
                    onClick={handleUserDropdownClick}
                    className="flex items-center gap-2 px-3 py-1 bg-transparent rounded-lg border border-[var(--input-border)] hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    <User className="w-4 h-4 text-[var(--muted-foreground)]" />
                    <span className="text-sm font-sans font-bold text-[var(--foreground)]">{user.name}</span>
                    <ChevronDown className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown menu - rendered in portal */}
                  {showUserDropdown && isClient && createPortal(
                    <>
                      {/* Click outside to close dropdown */}
                      <div 
                        className="fixed inset-0"
                        style={{ zIndex: 2147483646 }} // One less than dropdown
                        onClick={() => setShowUserDropdown(false)}
                      />
                      
                      {/* Dropdown content */}
                      <div 
                        className="w-48 bg-[var(--background)] border border-[var(--input-border)] rounded-lg shadow-xl"
                        style={{ 
                          position: 'fixed',
                          top: dropdownPosition.top,
                          right: dropdownPosition.right,
                          zIndex: 2147483647, // Maximum z-index value
                          isolation: 'isolate',
                          transform: 'translateZ(0)', // Force hardware acceleration
                          willChange: 'transform', // Optimize for changes
                          pointerEvents: 'auto' // Ensure it can be clicked
                        }}
                      >
                        <div className="py-2">
                          <button
                            onClick={() => {
                              setShowConfigModal(true);
                              setShowUserDropdown(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
                          >
                            <Settings className="w-4 h-4 text-[var(--muted-foreground)]" />
                            Configuración
                          </button>
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Logout button - separate from dropdown */}
                <button
                  onClick={handleLogoutClick}
                  className="p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            )}

            {/* Mobile hamburger menu button */}
            {activeTab && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                title="Menú"
              >
                {showMobileMenu ? <X className="w-5 h-5 text-[var(--foreground)]" /> : <Menu className="w-5 h-5 text-[var(--foreground)]" />}
              </button>
            )}

            <ThemeToggle />
          </div>
        </div>

        {/* Mobile navigation menu */}
        {showMobileMenu && activeTab && (
          <div className="lg:hidden border-t border-[var(--input-border)] bg-[var(--background)] p-4">
            <div className="grid grid-cols-2 gap-2">
              {visibleTabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      handleTabClick(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`flex items-center gap-2 p-3 rounded-md text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)]'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile user section */}
            {user && (
              <div className="mt-4 pt-4 border-t border-[var(--input-border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-[var(--muted-foreground)]" />
                    <div className="font-medium text-[var(--foreground)]">{user.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowConfigModal(true);
                        setShowMobileMenu(false);
                      }}
                      className="p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                      title="Configuración"
                    >
                      <Settings className="w-4 h-4 text-[var(--muted-foreground)]" />
                    </button>
                    <button
                      onClick={() => {
                        setShowMobileMenu(false);
                        handleLogoutClick();
                      }}
                      className="p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Cerrar Sesión"
                    >
                      <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-[var(--background)] rounded-lg p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Confirmar Cierre de Sesión</h3>
            <p className="text-[var(--muted-foreground)] mb-6">
              ¿Estás seguro de que quieres cerrar tu sesión?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-[var(--foreground)] flex items-center gap-3">
                  <Settings className="w-6 h-6 text-blue-600" />
                  Configuración del Sistema
                </h2>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* User Information */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  Información del Usuario
                </h3>
                <div className="bg-[var(--hover-bg)] rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <User className="w-8 h-8 text-[var(--muted-foreground)]" />
                    <div>
                      <div className="font-medium text-[var(--foreground)]">{user?.name}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">
                        Usuario activo: <strong>{user?.name}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Management */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  Gestión de Sesión
                </h3>
                <div className="space-y-4">
                  <TokenInfo isOpen={true} onClose={() => {}} inline={true} />
                  
                  {/* Toggle para FloatingSessionTimer */}
                  <div className="bg-[var(--hover-bg)] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {showSessionTimer ? (
                          <Timer className="w-5 h-5 text-blue-500" />
                        ) : (
                          <TimerOff className="w-5 h-5 text-gray-500" />
                        )}
                        <div>
                          <div className="font-medium text-[var(--foreground)]">
                            Temporizador Flotante
                          </div>
                          <div className="text-sm text-[var(--muted-foreground)]">
                            {showSessionTimer ? 'Visible en pantalla' : 'Oculto'}
                          </div>
                        </div>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={showSessionTimer}
                            onChange={(e) => setShowSessionTimer(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                            showSessionTimer 
                              ? 'bg-blue-600 shadow-lg' 
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}>
                          </div>
                          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                            showSessionTimer ? 'translate-x-6' : 'translate-x-0'
                          }`}>
                          </div>
                        </div>
                      </label>
                    </div>
                    <div className="mt-3 text-xs text-[var(--muted-foreground)]">
                      {showSessionTimer 
                        ? 'El temporizador de sesión se muestra en la esquina inferior derecha'
                        : 'Activa para mostrar el temporizador de sesión flotante'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="border-t border-[var(--input-border)] pt-6">
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-4">Acciones</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 bg-[var(--hover-bg)] text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => {
                      setShowConfigModal(false);
                      handleLogoutClick();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Click outside to close */}
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => setShowConfigModal(false)}
          />
        </div>
      )}

      {/* FloatingSessionTimer */}
      <FloatingSessionTimer
        visible={showSessionTimer}
        onToggleVisibility={() => setShowSessionTimer(false)}
      />
    </>
  );
}
