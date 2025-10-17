'use client';

import React, { useState, useEffect } from 'react';
import { Lock as LockIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

interface IVAOption {
  label: string;
  value: number;
}

const IVA_OPTIONS: IVAOption[] = [
  { label: 'EXENTO', value: 0 },
  { label: '1%', value: 1 },
  { label: '2%', value: 2 },
  { label: '13%', value: 13 }
];

export default function PriceCalculator() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [precioSinIVA, setPrecioSinIVA] = useState<string>('');
  const [precioConIVA, setPrecioConIVA] = useState<string>('');
  const [ivaSeleccionado, setIvaSeleccionado] = useState<number>(13);
  const [ivaPersonalizado, setIvaPersonalizado] = useState<string>('');
  const [usandoIvaPersonalizado, setUsandoIvaPersonalizado] = useState<boolean>(false);
  const [descuento, setDescuento] = useState<string>('');
  const [utilidad, setUtilidad] = useState<string>('');
  const [precioFinal, setPrecioFinal] = useState<string>('');
  const [precioOriginal, setPrecioOriginal] = useState<string>('');
  const [actualizandoDesde, setActualizandoDesde] = useState<string>('');

  // Función para formatear números sin decimales innecesarios
  const formatearNumero = (valor: string): string => {
    const num = parseFloat(valor);
    if (isNaN(num)) return valor;
    // Si es un número entero, mostrar sin decimales
    if (num % 1 === 0) return num.toString();
    // Si tiene decimales, mostrar tal como está
    return valor;
  };

  // Función para redondear precio final sin decimales
  const redondearPrecioFinal = (valor: number): number => {
    // Obtener los últimos dos dígitos para determinar el redondeo
    const ultimosDosDigitos = Math.floor(valor) % 100;
    const baseRedondeo = Math.floor(valor / 100) * 100;

    if (ultimosDosDigitos <= 12) return baseRedondeo;
    if (ultimosDosDigitos <= 37) return baseRedondeo + 25;
    if (ultimosDosDigitos <= 62) return baseRedondeo + 50;
    if (ultimosDosDigitos <= 87) return baseRedondeo + 75;
    return baseRedondeo + 100;
  };

  // Calcular precio con IVA desde precio sin IVA
  const calcularConIVA = (sinIVA: number, iva: number): number => {
    return sinIVA * (1 + iva / 100);
  };

  // Calcular precio sin IVA desde precio con IVA
  const calcularSinIVA = (conIVA: number, iva: number): number => {
    return conIVA / (1 + iva / 100);
  };

  // Aplicar descuento al precio sin IVA
  const aplicarDescuento = (sinIVA: number, descuentoPorcentaje: number): number => {
    return sinIVA * (1 - descuentoPorcentaje / 100);
  };

  // Calcular precio final con utilidad (basado en precio con IVA con descuento)
  const calcularPrecioConUtilidad = (conIVAConDescuento: number, utilidadPorcentaje: number): number => {
    const precioConUtilidad = conIVAConDescuento * (1 + utilidadPorcentaje / 100);
    return redondearPrecioFinal(precioConUtilidad);
  };

  // Calcular utilidad desde precio final (basado en precio con IVA con descuento)
  const calcularUtilidadDesdePrecioFinal = (precioFinal: number, conIVAConDescuento: number): number => {
    if (conIVAConDescuento === 0) return 0;
    return ((precioFinal - conIVAConDescuento) / conIVAConDescuento) * 100;
  };

  // Efectos para recalcular automáticamente
  useEffect(() => {
    if (actualizandoDesde === 'sinIVA' && precioSinIVA) {
      const sinIVA = parseFloat(precioSinIVA);
      if (!isNaN(sinIVA)) {
        // Solo establecer como precio original si no hay descuento aplicado actualmente
        // o si es la primera vez que se ingresa un valor
        const descuentoNum = parseFloat(descuento) || 0;

        if (descuentoNum === 0 || !precioOriginal) {
          setPrecioOriginal(formatearNumero(sinIVA.toFixed(2)));
        }

        // Calcular precio con IVA basado en el precio sin IVA actual
        const conIVA = calcularConIVA(sinIVA, ivaSeleccionado);
        setPrecioConIVA(formatearNumero(conIVA.toFixed(2)));

        // Calcular precio final con utilidad
        const utilidadNum = parseFloat(utilidad) || 0;
        const precioFinalCalculado = calcularPrecioConUtilidad(conIVA, utilidadNum);
        setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
      }
    }
  }, [precioSinIVA, ivaSeleccionado, utilidad, actualizandoDesde]); // eslint-disable-line react-hooks/exhaustive-deps

  // Efecto separado para manejar cambios en el descuento
  useEffect(() => {
    if (actualizandoDesde === 'descuento' && precioOriginal) {
      const sinIVAOriginal = parseFloat(precioOriginal);
      const descuentoNum = parseFloat(descuento) || 0;

      if (!isNaN(sinIVAOriginal)) {
        if (descuentoNum > 0) {
          const sinIVAConDescuento = aplicarDescuento(sinIVAOriginal, descuentoNum);

          // Actualizar precio sin IVA con el descuento aplicado
          setPrecioSinIVA(formatearNumero(sinIVAConDescuento.toFixed(2)));

          // Calcular precio con IVA
          const conIVAConDescuento = calcularConIVA(sinIVAConDescuento, ivaSeleccionado);
          setPrecioConIVA(formatearNumero(conIVAConDescuento.toFixed(2)));

          // Calcular precio final con utilidad
          const utilidadNum = parseFloat(utilidad) || 0;
          const precioFinalCalculado = calcularPrecioConUtilidad(conIVAConDescuento, utilidadNum);
          setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
        } else {
          // Sin descuento, restaurar precio original
          setPrecioSinIVA(formatearNumero(sinIVAOriginal.toFixed(2)));

          // Recalcular todo sin descuento
          const conIVA = calcularConIVA(sinIVAOriginal, ivaSeleccionado);
          setPrecioConIVA(formatearNumero(conIVA.toFixed(2)));

          const utilidadNum = parseFloat(utilidad) || 0;
          const precioFinalCalculado = calcularPrecioConUtilidad(conIVA, utilidadNum);
          setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
        }
      }
    }
  }, [descuento, actualizandoDesde, precioOriginal, ivaSeleccionado, utilidad]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (actualizandoDesde === 'conIVA' && precioConIVA) {
      const conIVA = parseFloat(precioConIVA);
      if (!isNaN(conIVA)) {
        const sinIVA = calcularSinIVA(conIVA, ivaSeleccionado);
        setPrecioSinIVA(formatearNumero(sinIVA.toFixed(2)));

        // NO establecer precio original cuando se calcula desde conIVA
        // Solo calcular precio final con utilidad
        const utilidadNum = parseFloat(utilidad) || 0;
        const precioFinalCalculado = calcularPrecioConUtilidad(conIVA, utilidadNum);
        setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
      }
    }
  }, [precioConIVA, ivaSeleccionado, utilidad, actualizandoDesde]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (actualizandoDesde === 'precioFinal' && precioFinal && precioSinIVA) {
      const pFinal = parseFloat(precioFinal);
      const sinIVA = parseFloat(precioSinIVA);
      if (!isNaN(pFinal) && !isNaN(sinIVA)) {
        const descuentoNum = parseFloat(descuento) || 0;
        let conIVAParaCalculo;

        if (descuentoNum > 0) {
          // Si hay descuento, usar el precio sin IVA actual (ya con descuento)
          conIVAParaCalculo = calcularConIVA(sinIVA, ivaSeleccionado);
        } else {
          // Sin descuento, usar el precio con IVA actual
          conIVAParaCalculo = parseFloat(precioConIVA);
        }

        const utilidadCalculada = calcularUtilidadDesdePrecioFinal(pFinal, conIVAParaCalculo);
        setUtilidad(formatearNumero(utilidadCalculada.toFixed(2)));
      }
    }
  }, [precioFinal, precioSinIVA, precioConIVA, ivaSeleccionado, actualizandoDesde]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrecioSinIVAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrecioSinIVA(e.target.value);
    setActualizandoDesde('sinIVA');
  };

  const establecerNuevoPrecioOriginal = () => {
    if (precioSinIVA) {
      setPrecioOriginal(precioSinIVA);
      // Limpiar descuento para evitar confusión
      setDescuento('');
      setActualizandoDesde('sinIVA');
    }
  };

  const handlePrecioConIVAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrecioConIVA(e.target.value);
    setActualizandoDesde('conIVA');
  };

  const handlePrecioFinalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrecioFinal(e.target.value);
    setActualizandoDesde('precioFinal');
  };

  const handleDescuentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoDescuento = e.target.value;
    setDescuento(nuevoDescuento);
  };

  const handleDescuentoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setActualizandoDesde('descuento');
    }
  };

  const handleUtilidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUtilidad(e.target.value);
    if (precioSinIVA) {
      setActualizandoDesde('sinIVA');
    }
  };

  const handleIVAChange = (nuevoIVA: number) => {
    setIvaSeleccionado(nuevoIVA);
    setUsandoIvaPersonalizado(false);
    setIvaPersonalizado('');
    if (precioSinIVA && actualizandoDesde === 'sinIVA') {
      setActualizandoDesde('sinIVA');
    } else if (precioConIVA && actualizandoDesde === 'conIVA') {
      setActualizandoDesde('conIVA');
    }
  };

  const handleIvaPersonalizadoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setIvaPersonalizado(valor);
    
    const ivaNum = parseFloat(valor);
    if (!isNaN(ivaNum) && ivaNum >= 0 && ivaNum <= 100) {
      setIvaSeleccionado(ivaNum);
      setUsandoIvaPersonalizado(true);
      
      if (precioSinIVA && actualizandoDesde === 'sinIVA') {
        setActualizandoDesde('sinIVA');
      } else if (precioConIVA && actualizandoDesde === 'conIVA') {
        setActualizandoDesde('conIVA');
      }
    }
  };

  // Verificar si el usuario tiene permiso para usar la calculadora
  if (!hasPermission(user?.permissions, 'calculator')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder a la Calculadora de Precios.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg shadow-md p-6" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
      <h2 className="text-xl font-semibold mb-6">Calculadora de Precios</h2>

      {/* Selector de IVA */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3">IVA</label>
        <div className="flex gap-2 flex-wrap mb-3">
          {IVA_OPTIONS.map((opcion) => (
            <button
              key={opcion.value}
              onClick={() => handleIVAChange(opcion.value)}
              className={`px-4 py-2 rounded-md border transition-colors ${ivaSeleccionado === opcion.value && !usandoIvaPersonalizado
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-transparent border-[var(--border)] hover:border-[var(--primary)]'
                }`}
            >
              {opcion.label}
            </button>
          ))}
        </div>
        
        {/* Campo para IVA personalizado */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">IVA personalizado (%):</label>
          <input
            type="number"
            value={ivaPersonalizado}
            onChange={handleIvaPersonalizadoChange}
            className={`w-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-black ${
              usandoIvaPersonalizado ? 'border-[var(--primary)] bg-[var(--muted)]' : 'border-[var(--border)]'
            }`}
            placeholder="0"
            step="0.01"
            min="0"
            max="100"
          />
          {usandoIvaPersonalizado && (
            <span className="text-sm text-[var(--primary)] font-medium">
              Usando {ivaSeleccionado}%
            </span>
          )}
        </div>
      </div>

      {/* Precios base */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Precio sin IVA</label>
            <div className="flex items-center gap-2">
              {precioOriginal && (
                <span className="text-xs text-gray-600">
                  Precio Original: ₡{precioOriginal}
                </span>
              )}
              {precioOriginal && precioSinIVA !== precioOriginal && (
                <button
                  onClick={establecerNuevoPrecioOriginal}
                  className="text-xs bg-[var(--secondary)] text-white px-2 py-1 rounded hover:opacity-90 transition-colors"
                  title="Establecer precio actual como nuevo precio original"
                >
                  Nuevo Original
                </button>
              )}
            </div>
          </div>
          <input
            type="number"
            value={precioSinIVA}
            onChange={handlePrecioSinIVAChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            placeholder="0.00"
            step="0.01"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Precio con IVA</label>
          <input
            type="number"
            value={precioConIVA}
            onChange={handlePrecioConIVAChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            placeholder="0.00"
            step="0.01"
          />
        </div>
      </div>

      {/* Descuento */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Descuento (%) - Presiona Enter para aplicar</label>
        <input
          type="number"
          value={descuento}
          onChange={handleDescuentoChange}
          onKeyDown={handleDescuentoKeyDown}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          placeholder="0"
          step="0.01"
          min="0"
          max="100"
        />
      </div>

      {/* Utilidad y Precio Final */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Utilidad (%)</label>
          <input
            type="number"
            value={utilidad}
            onChange={handleUtilidadChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            placeholder="0"
            step="0.01"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Precio Final</label>
          <input
            type="number"
            value={precioFinal}
            onChange={handlePrecioFinalChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-black"
            placeholder="0"
            step="1"
          />
        </div>
      </div>

      {/* Información adicional */}
      {precioSinIVA && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium mb-2 text-black">Resumen del cálculo:</h3>
          <div className="text-sm space-y-1 text-black">
            {precioOriginal ? (
              <>
                <div>Precio sin IVA original: ₡{precioOriginal}</div>
                {parseFloat(descuento) > 0 && (
                  <>
                    <div>Descuento ({descuento}%): -₡{(parseFloat(precioOriginal) * (parseFloat(descuento) || 0) / 100).toFixed(2)}</div>
                    <div>Precio sin IVA después del descuento: ₡{precioSinIVA}</div>
                  </>
                )}
                <div>IVA ({ivaSeleccionado}%): ₡{(parseFloat(precioConIVA) - parseFloat(precioSinIVA)).toFixed(2)}</div>
              </>
            ) : (
              <>
                <div>Precio sin IVA: ₡{precioSinIVA}</div>
                <div>IVA ({ivaSeleccionado}%): ₡{(parseFloat(precioConIVA) - parseFloat(precioSinIVA)).toFixed(2)}</div>
              </>
            )}
            <div>Precio con IVA: ₡{precioConIVA}</div>
            {utilidad && (
              <>
                <div>Utilidad ({utilidad}%): +₡{(parseFloat(precioConIVA) * (parseFloat(utilidad) || 0) / 100).toFixed(2)}</div>
                <div>Precio antes del redondeo: ₡{(parseFloat(precioConIVA) * (1 + (parseFloat(utilidad) || 0) / 100)).toFixed(2)}</div>
              </>
            )}
            <div className="font-semibold border-t pt-1">Precio Final: ₡{precioFinal}</div>
          </div>
        </div>
      )}
    </div>
  );
}
