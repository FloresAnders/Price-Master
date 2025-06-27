'use client'

import Image from 'next/image';
import { Settings, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';

export default function Header() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const isEditPage = pathname === '/edit';

  const handleLogoClick = () => {
    // Navega al HomeMenu (quita el hash)
    window.location.hash = '';
  };

  const handleSettingsClick = () => {
    // Navega a la página de edición
    window.location.href = '/edit';
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
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
      <header className="w-full flex items-center justify-between p-4 border-b border-[var(--input-border)] bg-transparent backdrop-blur-sm relative">
        {/* Stickman animado 
        <AnimatedStickman />*/}


        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--tab-text-active)] transition-colors cursor-pointer bg-transparent border-none p-0"
        >
          <Image src="/favicon.ico" alt="Logo" width={28} height={28} className="inline-block align-middle" />
          Price Master
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSettingsClick}
            className="p-2 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
            title="Configuración"
          >
            <Settings className="w-5 h-5 text-[var(--foreground)]" />
          </button>

          {isEditPage && (
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
      </header>

      {/* Modal de confirmación de logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-lg p-6 max-w-sm w-full border border-[var(--input-border)]">
            <div className="flex items-center gap-3 mb-4">
              <LogOut className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Cerrar Sesión
              </h3>
            </div>

            <p className="text-[var(--tab-text)] mb-6">
              ¿Está seguro que desea cerrar sesión y regresar al inicio?
            </p>

            <div className="flex gap-3 justify-end">
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
    </>
  );
}
