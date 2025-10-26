'use client';

import React, { useState, useEffect } from 'react';
import { Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, Settings, History } from 'lucide-react';
import AnimatedStickman from '../ui/AnimatedStickman';
import { User, UserPermissions } from '../../types/firestore';
import { getDefaultPermissions } from '../../utils/permissions';

const menuItems = [
  { id: 'scanner', name: 'Escáner', icon: Scan, description: 'Escanear códigos de barras', permission: 'scanner' as keyof UserPermissions },
  { id: 'calculator', name: 'Calculadora', icon: Calculator, description: 'Calcular precios con descuentos', permission: 'calculator' as keyof UserPermissions },
  { id: 'converter', name: 'Conversor', icon: Type, description: 'Convertir y transformar texto', permission: 'converter' as keyof UserPermissions },
  { id: 'cashcounter', name: 'Contador Efectivo', icon: Banknote, description: 'Contar billetes y monedas (CRC/USD)', permission: 'cashcounter' as keyof UserPermissions },
  { id: 'timingcontrol', name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos', permission: 'timingcontrol' as keyof UserPermissions },
  { id: 'controlhorario', name: 'Control Horario', icon: Clock, description: 'Registro de horarios de trabajo', permission: 'controlhorario' as keyof UserPermissions },
  { id: 'supplierorders', name: 'Órdenes Proveedor', icon: Truck, description: 'Gestión de órdenes de proveedores', permission: 'supplierorders' as keyof UserPermissions },
  { id: 'scanhistory', name: 'Historial de Escaneos', icon: History, description: 'Ver historial completo de escaneos', permission: 'scanhistory' as keyof UserPermissions },
  { id: 'edit', name: 'Mantenimiento', icon: Settings, description: 'Gestión y mantenimiento del sistema', permission: 'mantenimiento' as keyof UserPermissions },
  { id: 'solicitud', name: 'Solicitud', icon: Type, description: 'Solicitudes y trámites', permission: 'solicitud' as keyof UserPermissions },
];

interface HomeMenuProps {
  currentUser?: User | null;
}

export default function HomeMenu({ currentUser }: HomeMenuProps) {
  const [hovered, setHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showStickman, setShowStickman] = useState(false);

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
      userPermissions = getDefaultPermissions(currentUser.role || 'user');
    }

    // Filter items based on user permissions
    return menuItems.filter(item => {
      const hasPermission = userPermissions[item.permission];
      return hasPermission === true;
    });
  };

  const visibleMenuItems = getVisibleMenuItems();

  const handleNavigate = (id: string) => {
    if (typeof window !== 'undefined') {
      // Si la tarjeta es 'solicitud' mostramos un mensaje de desarrollo
      if (id === 'solicitud') {
        // Usamos alert simple para indicar 'desarrollo'
        // (se puede cambiar por un toast/modal más adelante)
        window.alert('desarrollo');
        return;
      }

      // Todos los demás elementos usan hash navigation
      window.location.hash = `#${id}`;
    }
  };

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    setHovered(h => !h);

    if (newCount >= 5) {
      setShowStickman(true);
    }
  };

  // Ocultar el AnimatedStickman después de 10 segundos
  useEffect(() => {
    if (showStickman) {
      const timer = setTimeout(() => {
        setShowStickman(false);
      }, 10000); // 10 segundos

      return () => clearTimeout(timer);
    }
  }, [showStickman]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <div className="mb-2 flex items-center justify-center">
        <Calculator
          className={`w-14 h-14 mr-2 transition-transform duration-300 ${hovered ? 'scale-110 rotate-12 text-[var(--foreground)]' : 'scale-100 text-[var(--tab-text-active)]'}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleLogoClick}
          style={{ cursor: 'pointer', filter: hovered ? 'drop-shadow(0 0 8px var(--foreground))' : 'none' }}
        />
      </div>
      <h1 className="text-3xl font-bold mb-8 text-center">Bienvenido a Time Master</h1>

      {visibleMenuItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-8 max-w-md mx-auto">
            <Settings className="w-16 h-16 mx-auto mb-4 text-[var(--primary)]" />
            <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)]">
              Sin herramientas disponibles
            </h3>
            <p className="text-[var(--muted-foreground)] mb-4">
              No tienes permisos para acceder a ninguna herramienta en este momento.
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              Contacta a tu administrador para obtener acceso a las funcionalidades que necesitas.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {visibleMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className="bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 flex flex-col items-center transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] group"
              style={{ minHeight: 160 }}
            >
              <item.icon className="w-10 h-10 mb-3 text-[var(--primary)] group-hover:scale-110 group-hover:text-[var(--button-hover)] transition-all" />
              <span className="text-lg font-semibold mb-1 text-[var(--foreground)] dark:text-[var(--foreground)]">{item.name}</span>
              <span className="text-sm text-[var(--muted-foreground)] text-center">{item.description}</span>
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
