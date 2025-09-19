'use client'

import Image from 'next/image';
import { Settings, LogOut, Menu, X, Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, History, User, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { getDefaultPermissions } from '../../utils/permissions';
import FloatingSessionTimer from '../session/FloatingSessionTimer';
import EditProfileModal from '../edicionPerfil/EditProfileModal';
import { ConfigurationModal, CalculatorModal } from '../modals';
import type { UserPermissions } from '../../types/firestore';

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
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [showSessionTimer, setShowSessionTimer] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);

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

  // Cargar preferencia de la calculadora desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPreference = localStorage.getItem('show-calculator');
      // Por defecto está desactivado (false)
      setShowCalculator(savedPreference === 'true');
    }
  }, []);

  // Guardar preferencia del FloatingSessionTimer cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('show-session-timer', showSessionTimer.toString());
    }
  }, [showSessionTimer]);

  // Guardar preferencia de la calculadora cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('show-calculator', showCalculator.toString());
    }
  }, [showCalculator]);

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
    // If neither modal is open, nothing to do
    if (!showConfigModal && !showEditProfileModal) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close whichever modal(s) are open
        if (showConfigModal) setShowConfigModal(false);
        if (showEditProfileModal) setShowEditProfileModal(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showConfigModal, showEditProfileModal]);

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
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors relative ${activeTab === tab.id
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
                              setShowEditProfileModal(true);
                              setShowUserDropdown(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
                          >
                            <User className="w-4 h-4 text-[var(--muted-foreground)]" />
                            Editar Perfil
                          </button>

                          <button
                            onClick={() => {
                              setShowConfigModal(true);
                              setShowUserDropdown(false);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
                          >
                            <Settings className="w-4 h-4 text-[var(--muted-foreground)]" />
                            Configuración de Sesión
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
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
              title="Menú"
            >
              {showMobileMenu ? <X className="w-5 h-5 text-[var(--foreground)]" /> : <Menu className="w-5 h-5 text-[var(--foreground)]" />}
            </button>

            <ThemeToggle />
          </div>
        </div>

        {/* Mobile navigation menu */}
        {showMobileMenu && (
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
                    className={`flex items-center gap-2 p-3 rounded-md text-sm transition-colors ${activeTab === tab.id
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
                        setShowEditProfileModal(true);
                        setShowMobileMenu(false);
                      }}
                      className="p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                      title="Editar Perfil"
                    >
                      <User className="w-4 h-4 text-[var(--muted-foreground)]" />
                    </button>

                    <button
                      onClick={() => {
                        setShowConfigModal(true);
                        setShowMobileMenu(false);
                      }}
                      className="p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                      title="Configuración de Sesión"
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
      <ConfigurationModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        showSessionTimer={showSessionTimer}
        onToggleSessionTimer={setShowSessionTimer}
        showCalculator={showCalculator}
        onToggleCalculator={setShowCalculator}
        onLogoutClick={handleLogoutClick}
      />

      <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} />

      {/* FloatingSessionTimer */}
      <FloatingSessionTimer
        visible={showSessionTimer}
        onToggleVisibility={() => setShowSessionTimer(false)}
      />

      {/* Global Calculator Button */}
      {showCalculator && (
        <button
          onClick={() => setShowCalculatorModal(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl z-40 transition-colors"
          aria-label="Abrir calculadora"
        >
          <Calculator className="w-6 h-6" />
        </button>
      )}

      {/* Global Calculator Modal */}
      <CalculatorModal 
        isOpen={showCalculatorModal} 
        onClose={() => setShowCalculatorModal(false)} 
      />
    </>
  );
}
