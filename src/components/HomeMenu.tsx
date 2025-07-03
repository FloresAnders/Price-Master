import React, { useState, useEffect } from 'react';
import { Scan, Calculator, Type, Banknote, Smartphone, Clock, Truck } from 'lucide-react';
import AnimatedStickman from './AnimatedStickman';

const menuItems = [
  { id: 'scanner', name: 'Escáner', icon: Scan, description: 'Escanear códigos de barras' },
  { id: 'calculator', name: 'Calculadora', icon: Calculator, description: 'Calcular precios con descuentos' },
  { id: 'converter', name: 'Conversor', icon: Type, description: 'Convertir y transformar texto' },
  { id: 'cashcounter', name: 'Contador Efectivo', icon: Banknote, description: 'Contar billetes y monedas (CRC/USD)' },
  { id: 'timingcontrol', name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos' },
  { id: 'controlhorario', name: 'Control Horario', icon: Clock, description: 'Registro de horarios de trabajo' },
  { id: 'supplierorders', name: 'Órdenes Proveedor', icon: Truck, description: 'Gestión de órdenes de proveedores' },
];

export default function HomeMenu() {
  const [hovered, setHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showStickman, setShowStickman] = useState(false);
  
  const handleNavigate = (id: string) => {
    window.location.hash = `#${id}`;
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
      <h1 className="text-3xl font-bold mb-8 text-center">Bienvenido a Price Master</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className="bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 flex flex-col items-center transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 group"
            style={{ minHeight: 160 }}
          >
            <item.icon className="w-10 h-10 mb-3 text-[var(--foreground)] group-hover:scale-110 transition-transform" />
            <span className="text-lg font-semibold mb-1 text-[var(--foreground)] dark:text-[var(--foreground)]">{item.name}</span>
            <span className="text-sm text-[var(--tab-text)] text-center">{item.description}</span>
          </button>
        ))}
      </div>
      
      {/* AnimatedStickman aparece solo después de 5 clicks */}
      {showStickman && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <AnimatedStickman />
        </div>
      )}
    </div>
  );
}
