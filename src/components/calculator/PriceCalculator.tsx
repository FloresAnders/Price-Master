"use client";

import React, { useState } from "react";
import { Lock as LockIcon } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { hasPermission } from "../../utils/permissions";

interface IVAOption {
  label: string;
  value: number;
}

const IVA_OPTIONS: IVAOption[] = [
  { label: "EXENTO", value: 0 },
  { label: "1%", value: 1 },
  { label: "2%", value: 2 },
  { label: "13%", value: 13 },
];

export default function PriceCalculator() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [precioSinIVA, setPrecioSinIVA] = useState<string>("");
  const [precioConIVA, setPrecioConIVA] = useState<string>("");
  const [ivaSeleccionado, setIvaSeleccionado] = useState<number>(13);
  const [ivaPersonalizado, setIvaPersonalizado] = useState<string>("");
  const [usandoIvaPersonalizado, setUsandoIvaPersonalizado] =
    useState<boolean>(false);
  const [descuento, setDescuento] = useState<string>("");
  const [utilidad, setUtilidad] = useState<string>("");
  const [precioFinal, setPrecioFinal] = useState<string>("");
  const [precioOriginal, setPrecioOriginal] = useState<string>("");

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
  const aplicarDescuento = (
    sinIVA: number,
    descuentoPorcentaje: number,
  ): number => {
    return sinIVA * (1 - descuentoPorcentaje / 100);
  };

  // Calcular precio final con utilidad (basado en precio con IVA con descuento)
  const calcularPrecioConUtilidad = (
    conIVAConDescuento: number,
    utilidadPorcentaje: number,
  ): number => {
    const precioConUtilidad =
      conIVAConDescuento * (1 + utilidadPorcentaje / 100);
    return redondearPrecioFinal(precioConUtilidad);
  };

  // Calcular utilidad desde precio final (basado en precio con IVA con descuento)
  const calcularUtilidadDesdePrecioFinal = (
    precioFinal: number,
    conIVAConDescuento: number,
  ): number => {
    if (conIVAConDescuento === 0) return 0;
    return ((precioFinal - conIVAConDescuento) / conIVAConDescuento) * 100;
  };

  const recalcularDesdeSinIVA = (
    sinIVA: number,
    iva: number,
    utilidadPorcentaje: number,
  ) => {
    const conIVA = calcularConIVA(sinIVA, iva);
    setPrecioConIVA(formatearNumero(conIVA.toFixed(2)));

    const precioFinalCalculado = calcularPrecioConUtilidad(
      conIVA,
      utilidadPorcentaje,
    );
    setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
  };

  const recalcularDesdeConIVA = (
    conIVA: number,
    iva: number,
    utilidadPorcentaje: number,
  ) => {
    const sinIVA = calcularSinIVA(conIVA, iva);
    setPrecioSinIVA(formatearNumero(sinIVA.toFixed(2)));

    const precioFinalCalculado = calcularPrecioConUtilidad(
      conIVA,
      utilidadPorcentaje,
    );
    setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
  };

  const aplicarDescuentoYRecalcular = (
    iva: number,
    descuentoPorcentaje: number,
    utilidadPorcentaje: number,
  ) => {
    const sinIVAOriginal = parseFloat(precioOriginal);
    if (Number.isNaN(sinIVAOriginal)) return;

    const sinIVAConDescuento =
      descuentoPorcentaje > 0
        ? aplicarDescuento(sinIVAOriginal, descuentoPorcentaje)
        : sinIVAOriginal;

    setPrecioSinIVA(formatearNumero(sinIVAConDescuento.toFixed(2)));
    recalcularDesdeSinIVA(sinIVAConDescuento, iva, utilidadPorcentaje);
  };

  const handlePrecioSinIVAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPrecioSinIVA(value);

    const sinIVA = parseFloat(value);
    if (Number.isNaN(sinIVA)) return;

    const descuentoNum = parseFloat(descuento) || 0;
    if (descuentoNum === 0 || !precioOriginal) {
      setPrecioOriginal(formatearNumero(sinIVA.toFixed(2)));
    }

    const utilidadNum = parseFloat(utilidad) || 0;
    recalcularDesdeSinIVA(sinIVA, ivaSeleccionado, utilidadNum);
  };

  const establecerNuevoPrecioOriginal = () => {
    if (precioSinIVA) {
      const sinIVA = parseFloat(precioSinIVA);
      if (Number.isNaN(sinIVA)) return;

      setPrecioOriginal(formatearNumero(sinIVA.toFixed(2)));
      setDescuento("");

      const utilidadNum = parseFloat(utilidad) || 0;
      recalcularDesdeSinIVA(sinIVA, ivaSeleccionado, utilidadNum);
    }
  };

  const handlePrecioConIVAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPrecioConIVA(value);

    const conIVA = parseFloat(value);
    if (Number.isNaN(conIVA)) return;

    const utilidadNum = parseFloat(utilidad) || 0;
    recalcularDesdeConIVA(conIVA, ivaSeleccionado, utilidadNum);
  };

  const handlePrecioFinalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPrecioFinal(value);

    const pFinal = parseFloat(value);
    if (Number.isNaN(pFinal)) return;

    const descuentoNum = parseFloat(descuento) || 0;
    const sinIVA = parseFloat(precioSinIVA);

    let conIVAParaCalculo: number | null = null;
    if (descuentoNum > 0 && !Number.isNaN(sinIVA)) {
      conIVAParaCalculo = calcularConIVA(sinIVA, ivaSeleccionado);
    } else {
      const conIVA = parseFloat(precioConIVA);
      conIVAParaCalculo = Number.isNaN(conIVA) ? null : conIVA;
    }

    if (!conIVAParaCalculo) return;
    const utilidadCalculada = calcularUtilidadDesdePrecioFinal(
      pFinal,
      conIVAParaCalculo,
    );
    setUtilidad(formatearNumero(utilidadCalculada.toFixed(2)));
  };

  const handleDescuentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoDescuento = e.target.value;
    setDescuento(nuevoDescuento);
  };

  const handleDescuentoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const descuentoNum = parseFloat(descuento) || 0;
      const utilidadNum = parseFloat(utilidad) || 0;
      if (precioOriginal) {
        aplicarDescuentoYRecalcular(ivaSeleccionado, descuentoNum, utilidadNum);
      }
    }
  };

  const handleUtilidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUtilidad(value);

    const utilidadNum = parseFloat(value) || 0;

    const conIVA = parseFloat(precioConIVA);
    if (!Number.isNaN(conIVA)) {
      const precioFinalCalculado = calcularPrecioConUtilidad(
        conIVA,
        utilidadNum,
      );
      setPrecioFinal(formatearNumero(precioFinalCalculado.toString()));
      return;
    }

    const sinIVA = parseFloat(precioSinIVA);
    if (!Number.isNaN(sinIVA)) {
      recalcularDesdeSinIVA(sinIVA, ivaSeleccionado, utilidadNum);
    }
  };

  const handleIVAChange = (nuevoIVA: number) => {
    setIvaSeleccionado(nuevoIVA);
    setUsandoIvaPersonalizado(false);
    setIvaPersonalizado("");

    const utilidadNum = parseFloat(utilidad) || 0;
    const sinIVA = parseFloat(precioSinIVA);
    const conIVA = parseFloat(precioConIVA);

    if (!Number.isNaN(sinIVA)) {
      recalcularDesdeSinIVA(sinIVA, nuevoIVA, utilidadNum);
      return;
    }
    if (!Number.isNaN(conIVA)) {
      recalcularDesdeConIVA(conIVA, nuevoIVA, utilidadNum);
    }
  };

  const handleIvaPersonalizadoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const valor = e.target.value;
    setIvaPersonalizado(valor);

    const ivaNum = parseFloat(valor);
    if (!isNaN(ivaNum) && ivaNum >= 0 && ivaNum <= 100) {
      setIvaSeleccionado(ivaNum);
      setUsandoIvaPersonalizado(true);

      const utilidadNum = parseFloat(utilidad) || 0;
      const sinIVA = parseFloat(precioSinIVA);
      const conIVA = parseFloat(precioConIVA);

      if (!Number.isNaN(sinIVA)) {
        recalcularDesdeSinIVA(sinIVA, ivaNum, utilidadNum);
      } else if (!Number.isNaN(conIVA)) {
        recalcularDesdeConIVA(conIVA, ivaNum, utilidadNum);
      }
    }
  };

  // Verificar si el usuario tiene permiso para usar la calculadora
  if (!hasPermission(user?.permissions, "calculator")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
            <LockIcon className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-white">
            Acceso Restringido
          </h3>
          <p className="text-sm text-slate-400">
            No tienes permisos para acceder a la Calculadora de Precios.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-start justify-center w-full max-w-7xl mx-auto px-2 sm:px-4 pt-0 pb-4 sm:pt-1 lg:pt-2">
      <div className="w-full max-w-7xl mx-auto sm:px-4">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
            <LockIcon className="w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">Calculadora de Precios</h2>
          <p className="mt-1 text-sm text-slate-400">
            Calcula IVA, descuento, utilidad y precio final desde una sola vista
          </p>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              IVA
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {IVA_OPTIONS.map((opcion) => (
                <button
                  key={opcion.value}
                  onClick={() => handleIVAChange(opcion.value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    ivaSeleccionado === opcion.value && !usandoIvaPersonalizado
                      ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-300"
                      : "border-white/10 bg-slate-900/50 text-slate-200 hover:border-white/20 hover:bg-slate-900/80"
                  }`}
                >
                  {opcion.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-sm font-semibold text-slate-300 whitespace-nowrap">
                IVA personalizado (%):
              </label>
              <input
                type="number"
                value={ivaPersonalizado}
                onChange={handleIvaPersonalizadoChange}
                className={`w-full rounded-lg border bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20 sm:w-32 ${
                  usandoIvaPersonalizado
                    ? "border-cyan-400/40"
                    : "border-white/10"
                }`}
                placeholder="0"
                step="0.01"
                min="0"
                max="100"
              />
              {usandoIvaPersonalizado && (
                <span className="text-sm font-medium text-cyan-300">
                  Usando {ivaSeleccionado}%
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-slate-300">
                  Precio sin IVA
                </label>
                {precioOriginal && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      Precio Original: ₡{precioOriginal}
                    </span>
                    {precioOriginal && precioSinIVA !== precioOriginal && (
                      <button
                        onClick={establecerNuevoPrecioOriginal}
                        className="rounded-lg border border-white/10 bg-slate-900/50 px-2 py-1 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-slate-900/80"
                        title="Establecer precio actual como nuevo precio original"
                      >
                        Nuevo Original
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input
                type="number"
                value={precioSinIVA}
                onChange={handlePrecioSinIVAChange}
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Precio con IVA
              </label>
              <input
                type="number"
                value={precioConIVA}
                onChange={handlePrecioConIVAChange}
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Descuento (%) - Presiona Enter para aplicar
            </label>
            <input
              type="number"
              value={descuento}
              onChange={handleDescuentoChange}
              onKeyDown={handleDescuentoKeyDown}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20"
              placeholder="0"
              step="0.01"
              min="0"
              max="100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Utilidad (%)
              </label>
              <input
                type="number"
                value={utilidad}
                onChange={handleUtilidadChange}
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20"
                placeholder="0"
                step="0.01"
                min="0"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Precio Final
              </label>
              <input
                type="number"
                value={precioFinal}
                onChange={handlePrecioFinalChange}
                className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20"
                placeholder="0"
                step="1"
              />
            </div>
          </div>

          {precioSinIVA && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">
                Resumen del cálculo:
              </h3>
              <div className="space-y-1 text-sm text-slate-200">
                {precioOriginal ? (
                  <>
                    <div>Precio sin IVA original: ₡{precioOriginal}</div>
                    {parseFloat(descuento) > 0 && (
                      <>
                        <div>
                          Descuento ({descuento}%): -₡
                          {(
                            (parseFloat(precioOriginal) *
                              (parseFloat(descuento) || 0)) /
                            100
                          ).toFixed(2)}
                        </div>
                        <div>
                          Precio sin IVA después del descuento: ₡{precioSinIVA}
                        </div>
                      </>
                    )}
                    <div>
                      IVA ({ivaSeleccionado}%): ₡
                      {(
                        parseFloat(precioConIVA) - parseFloat(precioSinIVA)
                      ).toFixed(2)}
                    </div>
                  </>
                ) : (
                  <>
                    <div>Precio sin IVA: ₡{precioSinIVA}</div>
                    <div>
                      IVA ({ivaSeleccionado}%): ₡
                      {(
                        parseFloat(precioConIVA) - parseFloat(precioSinIVA)
                      ).toFixed(2)}
                    </div>
                  </>
                )}
                <div>Precio con IVA: ₡{precioConIVA}</div>
                {utilidad && (
                  <>
                    <div>
                      Utilidad ({utilidad}%): +₡
                      {(
                        (parseFloat(precioConIVA) * (parseFloat(utilidad) || 0)) /
                        100
                      ).toFixed(2)}
                    </div>
                    <div>
                      Precio antes del redondeo: ₡
                      {(
                        parseFloat(precioConIVA) *
                        (1 + (parseFloat(utilidad) || 0) / 100)
                      ).toFixed(2)}
                    </div>
                  </>
                )}
                <div className="border-t border-white/10 pt-1 text-xl font-semibold text-white">
                  Precio Final: ₡{precioFinal}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
