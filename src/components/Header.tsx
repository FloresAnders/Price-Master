'use client'

import Image from 'next/image';
import { Settings, LogOut, Menu, X, Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, History } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';

type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'timingcontrol' | 'controlhorario' | 'supplierorders' | 'histoscans'

interface HeaderProps {
  activeTab?: ActiveTab | null;
  onTabChange?: (tab: ActiveTab | null) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const isEditPage = pathname === '/edit';
  const isBackdoorPage = pathname === '/backdoor';

  // Ensure component is mounted on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Navigation tabs
  const tabs = [
    { id: 'scanner' as ActiveTab, name: 'Escáner', icon: Scan, description: 'Escanear códigos de barras' },
    { id: 'calculator' as ActiveTab, name: 'Calculadora', icon: Calculator, description: 'Calcular precios con descuentos' },
    { id: 'converter' as ActiveTab, name: 'Conversor', icon: Type, description: 'Convertir y transformar texto' },
    {
      id: 'cashcounter' as ActiveTab,
      name: 'Contador Efectivo',
      icon: Banknote,
      description: 'Contar billetes y monedas (CRC/USD)'
    },
    { id: 'timingcontrol' as ActiveTab, name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos' },
    { id: 'controlhorario' as ActiveTab, name: 'Control Horario', icon: Clock, description: 'Registro de horarios de trabajo' },
    { id: 'supplierorders' as ActiveTab, name: 'Órdenes Proveedor', icon: Truck, description: 'Gestión de órdenes de proveedores' },
    { id: 'histoscans' as ActiveTab, name: 'Historial de Escaneos', icon: History, description: 'Ver historial de escaneos realizados' },
  ];

  // Filter tabs for backdoor (only show specific tabs)
  const displayTabs = isBackdoorPage
    ? tabs.filter(tab => ['scanner', 'controlhorario', 'histoscans'].includes(tab.id))
    : tabs.filter(tab => tab.id !== 'histoscans'); // Exclude histoscans from main page

  const handleLogoClick = () => {
    if (!isClient) return;
    
    if (isEditPage) {
      // Si está en la página de edición, mostrar advertencia
      setShowHomeConfirm(true);
    } else if (isBackdoorPage) {
      // Si está en backdoor, redirigir a /backdoor
      window.location.href = '/backdoor';
    } else {
      // Si está en la página principal, redirigir a /
      window.location.href = '/';
    }
  };

  const handleTabClick = (tabId: ActiveTab) => {
    if (!isClient) return;
    
    onTabChange?.(tabId);
    // Map histoscans tab to historial hash for backdoor
    const hashId = isBackdoorPage && tabId === 'histoscans' ? 'historial' : tabId;
    window.location.hash = `#${hashId}`;
    setShowMobileMenu(false); // Close mobile menu when tab is selected
  };

  const confirmGoHome = () => {
    if (!isClient) return;
    
    // Cerrar sesión y regresar al inicio
    logout('Navigating to home from edit page');
    setShowHomeConfirm(false);
    window.location.href = '/';
  };

  const cancelGoHome = () => {
    setShowHomeConfirm(false);
  };

  const handleSettingsClick = () => {
    if (!isClient) return;
    
    // Navega a la página de edición
    window.location.href = '/edit';
  };

  const handleLogoutClick = () => {
    if (!isClient) return;
    
    if (isBackdoorPage) {
      // For backdoor, logout directly without confirmation
      localStorage.removeItem('simple_login_user');
      window.location.href = '/login';
    } else {
      setShowLogoutConfirm(true);
    }
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
            {isBackdoorPage ? 'Price Master BackDoor' : 'Price Master'}
          </button>

          {/* Desktop navigation - centered */}
          {!isEditPage && activeTab && (
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
            {/* Mobile hamburger menu button */}
            {!isEditPage && activeTab && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                title="Menú"
              >
                {showMobileMenu ? <X className="w-5 h-5 text-[var(--foreground)]" /> : <Menu className="w-5 h-5 text-[var(--foreground)]" />}
              </button>
            )}

            {!isBackdoorPage && (
              <button
                onClick={handleSettingsClick}
                className="p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                title="Configuración"
              >
                <Settings className="w-5 h-5 text-[var(--foreground)]" />
              </button>
            )}

            {(isEditPage || isBackdoorPage) && (
              <button
                onClick={handleLogoutClick}
                className="p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
              </button>
            )}

            <ThemeToggle />
          </div>
        </div>

        {/* Mobile navigation menu */}
        {showMobileMenu && !isEditPage && activeTab && (
          <div className="lg:hidden border-t border-[var(--input-border)] bg-[var(--card-bg)]" suppressHydrationWarning>
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
              ¿Está seguro que desea cerrar sesión y regresar al inicio?
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

      {/* Modal de confirmación para ir al home */}
      {showHomeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" suppressHydrationWarning>
          <div className="bg-[var(--card-bg)] rounded-lg p-6 max-w-sm w-full border border-[var(--input-border)]" suppressHydrationWarning>
            <div className="flex items-center gap-3 mb-4" suppressHydrationWarning>
              <LogOut className="w-6 h-6 text-orange-600" />
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Ir al Inicio
              </h3>
            </div>

            <p className="text-[var(--tab-text)] mb-6">
              Al regresar al inicio, su sesión será cerrada. ¿Desea continuar?
            </p>

            <div className="flex gap-3 justify-end" suppressHydrationWarning>
              <button
                onClick={cancelGoHome}
                className="px-4 py-2 rounded-md border border-[var(--input-border)] text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmGoHome}
                className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors"
              >
                Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
