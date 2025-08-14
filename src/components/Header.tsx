'use client'

import Image from 'next/image';
import { Settings, Menu, X, Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, History } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';

type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'timingcontrol' | 'controlhorario' | 'supplierorders' | 'histoscans' | 'scanhistory' | 'edit'

interface HeaderProps {
  activeTab?: ActiveTab | null;
  onTabChange?: (tab: ActiveTab | null) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure component is mounted on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Navigation tabs - all available without permissions
  const allTabs = [
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
    { id: 'edit' as ActiveTab, name: 'Mantenimiento', icon: Settings, description: 'Gestión y mantenimiento del sistema' },
    { id: 'histoscans' as ActiveTab, name: 'Historial de Escaneos', icon: History, description: 'Ver historial de escaneos realizados' },
  ];

  // Mostrar todas las pestañas sin restricciones de permisos
  const displayTabs = allTabs;

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
    </>
  );
}
