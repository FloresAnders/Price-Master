"use client";
import Image from 'next/image';
import Fireworks from 'fireworks-js';
import React, { useState, useEffect, useRef } from 'react';
import { Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck, Settings, History } from 'lucide-react';
import AnimatedStickman from '../ui/AnimatedStickman';
import { User, UserPermissions } from '../../types/firestore';
import { getDefaultPermissions } from '../../utils/permissions';

const menuItems = [
  { id: 'scanner', name: 'Escáner', icon: Scan, description: 'Escanear códigos de barras', permission: 'scanner' as keyof UserPermissions },
  { id: 'calculator', name: 'Calculadora', icon: Calculator, description: 'Calcular precios con descuentos', permission: 'calculator' as keyof UserPermissions },
  { id: 'converter', name: 'Conversor', icon: Type, description: 'Convertir y transformar texto', permission: 'converter' as keyof UserPermissions },
  { id: 'cashcounter', name: 'Contador Efectivo', icon: Banknote, description: 'Contar billetes y monedas (CRC/USD)', permission: 'cashcounter' as keyof UserPermissions },
  { id: 'fondogeneral', name: 'Fondo General', icon: Banknote, description: 'Administrar el fondo general', permission: 'fondogeneral' as keyof UserPermissions },
  { id: 'timingcontrol', name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos', permission: 'timingcontrol' as keyof UserPermissions },
  { id: 'controlhorario', name: 'Control Horario', icon: Clock, description: 'Registro de horarios de trabajo', permission: 'controlhorario' as keyof UserPermissions },
  { id: 'calculohorasprecios', name: 'Calculo horas precios', icon: Calculator, description: 'Cálculo de horas y precios (planilla)', permission: 'calculohorasprecios' as keyof UserPermissions },
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
  const [showChristmasToast, setShowChristmasToast] = useState(false);

  const fireworksRef = useRef<HTMLDivElement>(null);
  const [fireworksInstance, setFireworksInstance] = useState<Fireworks | null>(null);

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
      // Redirigir a la ruta específica para la herramienta usando hash navigation
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

  // Mostrar fuegos artificiales automáticamente al ingresar al HomeMenu durante 6 segundos
  useEffect(() => {
    if (fireworksRef.current && !fireworksInstance) {
      const fw = new Fireworks(fireworksRef.current);
      fw.start();
      setFireworksInstance(fw);

      const timer = setTimeout(() => {
        fw.stop();
        setFireworksInstance(null);
      }, 6000); // 6 segundos

      return () => clearTimeout(timer);
    }
  }, []); // Se ejecuta solo al montar el componente

  // Ocultar el AnimatedStickman después de 10 segundos
  useEffect(() => {
    if (showStickman) {
      const timer = setTimeout(() => {
        setShowStickman(false);
      }, 10000); // 10 segundos

      return () => clearTimeout(timer);
    }
  }, [showStickman]);

  // Mostrar el toast al entrar y ocultarlo a los 5 segundos
  useEffect(() => {
    setShowChristmasToast(true);
    const timer = setTimeout(() => {
      setShowChristmasToast(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-8">
      <div ref={fireworksRef} className="fixed inset-0 pointer-events-none z-40" />
      <div className="mb-2 flex items-center justify-center relative">
        {showChristmasToast && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            aria-live="polite"
          >
            <div className="christmas-toast whitespace-nowrap rounded-full border border-[var(--input-border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] shadow-md">
              FELIZ AÑO NUEVO!!
            </div>
          </div>
        )}
        <style jsx>{`
        .christmas-toast {
          transform-origin: center;
          will-change: transform, opacity;
          animation:
            toast-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both,
            toast-beat 900ms ease-in-out 280ms infinite;
        }

        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes toast-beat {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .christmas-toast {
            animation: none;
          }
        }
      `}</style>
        <Image
          src="/Logos/LogoBlanco2.png"
          alt="Time Master logo"
          className={`w-28 h-28 mr-2 transition-transform duration-300 ${hovered ? 'scale-110 rotate-12' : 'scale-100'}`}
          width={56}
          height={56}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleLogoClick}
          style={{ cursor: 'pointer', filter: hovered ? 'drop-shadow(0 0 8px var(--foreground))' : 'none' }}
        />
      </div>
      <h1 className="text-3xl font-bold mb-8 text-center">
        {currentUser ? `¡Qué gusto verte, ${currentUser.name ?? currentUser.email ?? 'Usuario'} !` : '¡Qué gusto verte!'}
      </h1>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-screen-xl pt-4">
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
              {/* No badge shown here; navigation goes to the Fondo General page */}
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
