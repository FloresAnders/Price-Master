'use client'

import Image from 'next/image';
import { Settings, LogOut, Menu, X, Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, History, User, ChevronDown, Shield, Key, Clock4 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { getDefaultPermissions } from '../utils/permissions';
import SessionMonitor from './SessionMonitor';
import SessionCounter from './SessionCounter';
import TokenInfo from './TokenInfo';
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
  const [showFloatingCounter, setShowFloatingCounter] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Ensure component is mounted on client
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  // Filter tabs based on user permissions
  const getVisibleTabs = () => {
    if (!user) {
      return allTabs; // Fallback for safety
    }

    // Get user permissions or default permissions based on role
    let userPermissions: UserPermissions;
    if (user.permissions) {
      userPermissions = user.permissions;
    } else {
      userPermissions = getDefaultPermissions(user.role || 'user');
    }

    return allTabs.filter(tab => {
      const hasPermission = userPermissions[tab.permission];
      return hasPermission === true;
    });
  };

  const tabs = getVisibleTabs();

  // Show all tabs
  const displayTabs = tabs;

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
    setShowMobileMenu(false); // Close mobile menu when tab is selected
  };

  const handleLogoutClick = () => {
    if (!isClient) return;
    
    // Show confirmation for logout
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    if (!isClient) return;
    
    // Cerrar sesión usando el hook de autenticación
    logout('Manual logout from edit page');
    setShowLogoutConfirm(false);
    // Regresar al inicio después del logout
    window.location.href = '/';
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  return (
    <>
      <header className="w-full border-b border-[var(--input-border)] bg-transparent backdrop-blur-sm relative overflow-hidden">
        {/* Main header row */}
        <div className="flex items-center justify-between p-4" suppressHydrationWarning>
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--tab-text-active)] transition-colors cursor-pointer bg-transparent border-none p-0"
          >
            <Image src="/favicon.ico" alt="Logo" width={28} height={28} className="inline-block align-middle" />
            Price Master
          </button>

          {/* Desktop navigation - centered */}
          {activeTab && (
            <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 transform -translate-x-1/2">
              {displayTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 relative
                    ${activeTab === tab.id
                      ? 'text-[var(--tab-text-active)] font-semibold'
                      : 'text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:bg-[var(--hover-bg)]'
                    }`}
                  title={tab.description}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--tab-text-active)] rounded-full"></div>
                  )}
                </button>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2" suppressHydrationWarning>
            {/* User dropdown menu */}
            {user && (
              <div className="hidden md:flex items-center gap-2">
                {/* User button with dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 px-3 py-1 bg-transparent rounded-lg border border-[var(--input-border)] hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    <User className="w-4 h-4 text-[var(--muted-foreground)]" />
                    <span className="text-sm font-sans font-bold text-[var(--foreground)]">{user.name}</span>
                    <ChevronDown className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown menu */}
                  {showUserDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--background)] border border-[var(--input-border)] rounded-lg shadow-lg z-[9999]">
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
                  )}

                  {/* Click outside to close dropdown */}
                  {showUserDropdown && (
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={() => setShowUserDropdown(false)}
                    />
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
          <div className="lg:hidden border-t border-[var(--input-border)] bg-[var(--card-bg)]" suppressHydrationWarning>
            {/* User info in mobile menu */}
            {user && (
              <div className="px-4 py-3 border-b border-[var(--input-border)] bg-[var(--hover-bg)]">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-[var(--muted-foreground)]" />
                  <div className="font-medium text-[var(--foreground)]">{user.name}</div>
                </div>
                
                {user.location && (
                  <div className="text-sm text-[var(--muted-foreground)] mb-3">
                    {user.location}
                  </div>
                )}

                {/* Mobile configuration and logout buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowConfigModal(true);
                      setShowMobileMenu(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors bg-blue-50 dark:bg-blue-900/20"
                  >
                    <Settings className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Configuración</span>
                  </button>

                  <button
                    onClick={() => {
                      handleLogoutClick();
                      setShowMobileMenu(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
            
            <nav className="px-4 py-2 space-y-1">
              {displayTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 relative
                    ${activeTab === tab.id
                      ? 'text-[var(--tab-text-active)] font-semibold'
                      : 'text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:bg-[var(--hover-bg)]'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <div suppressHydrationWarning>
                    <div>{tab.name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{tab.description}</div>
                  </div>
                  {activeTab === tab.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--tab-text-active)] rounded-r-full"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Modal de confirmación de logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" suppressHydrationWarning>
          <div className="bg-[var(--card-bg)] rounded-lg p-6 max-w-sm w-full border border-[var(--input-border)]" suppressHydrationWarning>
            <div className="flex items-center gap-3 mb-4" suppressHydrationWarning>
              <LogOut className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Cerrar Sesión
              </h3>
            </div>

            <p className="text-[var(--tab-text)] mb-6">
              ¿Está seguro que desea cerrar sesión?
              {user && (
                <span className="block mt-2 text-sm text-[var(--muted-foreground)]">
                  Usuario activo: <strong>{user.name}</strong>
                </span>
              )}
            </p>

            <div className="flex gap-3 justify-end" suppressHydrationWarning>
              <button
                onClick={cancelLogout}
                className="px-4 py-2 rounded-md border border-[var(--input-border)] text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal - Fullscreen Floating */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--input-border)] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--input-border)] p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-blue-500" />
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">Configuración</h2>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--muted-foreground)]" />
                </button>
              </div>
              
              {/* User Info Header */}
              <div className="mt-4 flex items-center gap-3 p-3 bg-[var(--hover-bg)] rounded-lg">
                <User className="w-8 h-8 text-[var(--muted-foreground)]" />
                <div>
                  <div className="font-medium text-[var(--foreground)]">{user?.name}</div>
                  <div className="text-sm text-[var(--muted-foreground)]">{user?.role}</div>
                  {user?.location && (
                    <div className="text-xs text-[var(--muted-foreground)]">{user.location}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Session Management Section */}
              <div>
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  Gestión de Sesión
                </h3>
                
                {/* Session Monitor Integration */}
                <div className="bg-[var(--hover-bg)] rounded-lg p-4 mb-4">
                  <SessionMonitor inline={true} />
                </div>

                {/* Token Information Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Key className="w-5 h-5 text-blue-500" />
                    <h4 className="font-medium text-[var(--foreground)]">Información del Token</h4>
                  </div>
                  <TokenInfo isOpen={true} onClose={() => {}} inline={true} />
                </div>
              </div>

              {/* Session Counter Display */}
              <div>
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-4 flex items-center gap-2">
                  <Clock4 className="w-5 h-5 text-orange-500" />
                  Contador de Tiempo
                </h3>
                <div className="bg-[var(--hover-bg)] rounded-lg p-4">
                  <p className="text-sm text-[var(--muted-foreground)] mb-3">
                    El contador flotante muestra el tiempo restante de tu sesión/token y se puede arrastrar por la pantalla.
                  </p>
                  
                  {/* Toggle Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-3 h-3 rounded-full ${showFloatingCounter ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-[var(--foreground)]">
                        {showFloatingCounter ? 'Contador activo en pantalla' : 'Contador desactivado'}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => setShowFloatingCounter(!showFloatingCounter)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        showFloatingCounter ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showFloatingCounter ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="border-t border-[var(--input-border)] pt-6">
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-4">Acciones</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Guardar Configuración
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

      {/* Session Counter - floating component */}
      {showFloatingCounter && <SessionCounter />}
    </>
  );
}
