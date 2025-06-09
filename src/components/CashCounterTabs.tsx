'use client';
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  MinusCircle,
  XCircle,
  Trash2,
  Calculator as CalculatorIcon,
  DollarSign,
  Edit3,
  Inbox,
  Eraser,
  Download,
  Upload,
} from 'lucide-react';

type CalculatorModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState<string>('');

  const handleButtonClick = React.useCallback((value: string) => {
    if (value === '=') {
      try {
        const result = eval(display);
        setDisplay(String(result));
      } catch {
        setDisplay('Error');
      }
      return;
    }
    if (value === 'C') {
      setDisplay('');
      return;
    }
    setDisplay((prev) => prev + value);
  }, [display]);

  // Permitir uso de teclado
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter' || e.key === '=') {
        handleButtonClick('=');
        e.preventDefault();
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        handleButtonClick('C');
        e.preventDefault();
        return;
      }
      if (e.key === 'Backspace') {
        setDisplay((prev) => prev.slice(0, -1));
        e.preventDefault();
        return;
      }
      if (["+", "-", "*", "/", "."].includes(e.key)) {
        handleButtonClick(e.key);
        e.preventDefault();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        handleButtonClick(e.key);
        e.preventDefault();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleButtonClick, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-[20rem] p-4 relative">
        <button
          className="absolute top-2 right-2 text-[var(--foreground)] hover:text-gray-500"
          onClick={onClose}
          aria-label="Cerrar calculadora"
        >
          <XCircle className="w-6 h-6" />
        </button>
        <h2 className="text-center font-semibold mb-2 text-[var(--foreground)] text-base">
          Calculadora
        </h2>
        <div className="border rounded-lg mb-3 h-10 flex items-center justify-end px-2 bg-[var(--input-bg)]">
          <span className="text-lg text-[var(--foreground)]">{display || '0'}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[
            '7',
            '8',
            '9',
            '/',
            '4',
            '5',
            '6',
            '*',
            '1',
            '2',
            '3',
            '-',
            '0',
            '.',
            'C',
            '+',
          ].map((btn) => (
            <button
              key={btn}
              onClick={() => handleButtonClick(btn)}
              className="bg-[var(--button-bg)] hover:bg-[var(--button-hover)] rounded py-2 text-sm text-[var(--foreground)] flex items-center justify-center"
            >
              {btn}
            </button>
          ))}
          <button
            onClick={() => handleButtonClick('=')}
            className="col-span-4 bg-blue-600 hover:bg-blue-700 text-white rounded py-2 mt-1 text-sm"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
}

type BillsMap = Record<number, number>;

type CashCounterData = {
  name: string;
  bills: BillsMap;
  extraAmount: number;
  currency: 'CRC' | 'USD';
};

type CashCounterProps = {
  id: number;
  data: CashCounterData;
  onUpdate: (index: number, newData: CashCounterData) => void;
  onDelete: (index: number) => void;
  onCurrencyOpen: () => void;
};

function CashCounter({ id, data, onUpdate, onDelete, onCurrencyOpen }: CashCounterProps) {
  // Denominaciones fijas según moneda
  const denominacionesCRC = [
    { label: '₡ 20 000', value: 20000 },
    { label: '₡ 10 000', value: 10000 },
    { label: '₡ 5 000', value: 5000 },
    { label: '₡ 2 000', value: 2000 },
    { label: '₡ 1 000', value: 1000 },
    { label: '₡ 500', value: 500 },
    { label: '₡ 100', value: 100 },
    { label: '₡ 50', value: 50 },
    { label: '₡ 25', value: 25 },
  ];

  const denominacionesUSD = [
    { label: '$ 100', value: 100 },
    { label: '$ 50', value: 50 },
    { label: '$ 20', value: 20 },
    { label: '$ 10', value: 10 },
    { label: '$ 5', value: 5 },
    { label: '$ 1', value: 1 },
  ];

  const denominaciones = data.currency === 'CRC' ? denominacionesCRC : denominacionesUSD;

  // Estado interno local
  const [bills, setBills] = useState<BillsMap>({ ...data.bills });
  const [extraAmount, setExtraAmount] = useState<number>(data.extraAmount);
  const [currency, setCurrency] = useState<'CRC' | 'USD'>(data.currency);
  const [showExtra, setShowExtra] = useState<boolean>(false);

  // Estado para apertura de caja y venta actual
  const [aperturaCaja, setAperturaCaja] = useState<number | ''>('');
  const [ventaActual, setVentaActual] = useState<number | ''>('');

  // Sincronizar props → estado interno
  useEffect(() => {
    setBills({ ...data.bills });
    setExtraAmount(data.extraAmount);
    setCurrency(data.currency);
  }, [data]);

  // Notificar al padre cuando cambia algún valor
  const notifyParent = (newBills: BillsMap, newExtra: number, newCurrency: 'CRC' | 'USD') => {
    onUpdate(id, {
      ...data,
      bills: newBills,
      extraAmount: newExtra,
      currency: newCurrency,
    });
  };

  const handleIncrement = (value: number) => {
    const newBills = {
      ...bills,
      [value]: (bills[value] || 0) + 1,
    };
    setBills(newBills);
    notifyParent(newBills, extraAmount, currency);
  };

  const handleDecrement = (value: number) => {
    const newCount = Math.max((bills[value] || 0) - 1, 0);
    const newBills = { ...bills, [value]: newCount };
    setBills(newBills);
    notifyParent(newBills, extraAmount, currency);
  };

  const handleManualChange = (value: number, newCount: string) => {
    // Usamos string para evitar ceros iniciales; convertimos a número al validar
    const parsed = parseInt(newCount.replace(/^0+/, ''), 10);
    const sanitized = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const newBills = { ...bills, [value]: sanitized };
    setBills(newBills);
    notifyParent(newBills, extraAmount, currency);
  };

  const computeTotal = (): number => {
    const sumBills = Object.entries(bills).reduce((acc, [den, count]) => {
      return acc + Number(den) * Number(count);
    }, 0);
    return sumBills + extraAmount;
  };

  const formatCRC = (num: number) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatUSD = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Manejador del input de monto adicional (formateo instantáneo)
  const handleExtraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (currency === 'CRC') {
      // Solo dígitos
      raw = raw.replace(/\D/g, '');
      const parsed = raw === '' ? 0 : parseInt(raw, 10);
      setExtraAmount(parsed);
      notifyParent(bills, parsed, currency);
    } else {
      // Permitir dígitos y punto
      raw = raw.replace(/[^0-9.]/g, '');
      const parsedFloat = parseFloat(raw);
      const parsed = isNaN(parsedFloat) ? 0 : parsedFloat;
      // Guardamos en centavos para USD
      setExtraAmount(parsed);
      notifyParent(bills, parsed, currency);
    }
  };

  const handleExtraClear = () => {
    setExtraAmount(0);
    notifyParent(bills, 0, currency);
  };

  return (
    <div className="relative p-4 bg-[var(--card-bg)] rounded-2xl shadow-lg w-full">
      {/* Header reorganizado para móvil: iconos centrados arriba, nombre debajo */}
      <div className="flex flex-col items-center mb-4">
        <div className="flex space-x-4 mb-2">
          {/* Botón para limpiar todos los contadores */}
          <button
            onClick={() => {
              if (confirm('¿Seguro que deseas limpiar todos los montos?')) {
                const resetBills: BillsMap = {};
                denominaciones.forEach((den) => {
                  resetBills[den.value] = 0;
                });
                setBills(resetBills);
                setExtraAmount(0);
                notifyParent(resetBills, 0, currency);
              }
            }}
            className="text-yellow-500 hover:text-yellow-700"
            aria-label="Limpiar todos los montos"
          >
            <Eraser className="w-6 h-6" />
          </button>
          {/* Botón para descargar datos */}
          <button
            onClick={() => {
              const content = JSON.stringify({ name: data.name, bills, extraAmount, currency });
              const blob = new Blob([content], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${data.name}_datos.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-blue-500 hover:text-blue-700"
            aria-label="Descargar datos"
          >
            <Download className="w-6 h-6" />
          </button>
          {/* Botón para subir/importar datos */}
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'application/json';
              input.onchange = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const parsed = JSON.parse(ev.target?.result as string);
                    if (
                      parsed &&
                      typeof parsed.name === 'string' &&
                      typeof parsed.extraAmount === 'number' &&
                      (parsed.currency === 'CRC' || parsed.currency === 'USD') &&
                      typeof parsed.bills === 'object'
                    ) {
                      setBills(parsed.bills);
                      setExtraAmount(parsed.extraAmount);
                      setCurrency(parsed.currency);
                      notifyParent(parsed.bills, parsed.extraAmount, parsed.currency);
                    } else {
                      alert('Archivo JSON inválido para Cash Counter.');
                    }
                  } catch {
                    alert('Error al parsear el archivo JSON.');
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
            className="text-blue-500 hover:text-blue-700"
            aria-label="Subir datos"
          >
            <Upload className="w-6 h-6" />
          </button>
          {/* Botón para cambiar moneda */}
          <button
            onClick={onCurrencyOpen}
            className="text-green-600 hover:text-green-800"
            aria-label="Cambiar moneda"
          >
            <DollarSign className="w-6 h-6" />
          </button>
          {/* Botón para eliminar contador (con confirmación) */}
          <button
            onClick={() => {
              if (confirm('¿Seguro que deseas eliminar este contador?')) {
                onDelete(id);
              }
            }}
            className="text-red-500 hover:text-red-700"
            aria-label={`Eliminar contador ${id + 1}`}
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </div>
        {/* Nombre del contador centrado, debajo de los iconos */}
        <h3 className="text-center font-semibold text-[var(--foreground)] text-lg">
          {data.name}
        </h3>
      </div>

      {/* Botón para monto adicional fijo */}
      <div className="fixed bottom-32 left-6 z-20">
        <button
          onClick={() => setShowExtra((prev) => !prev)}
          className="bg-green-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl"
          aria-label="Mostrar monto adicional"
        >
          <PlusCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Input de monto adicional estilo modal */}
      {showExtra && (
        <div className="fixed bottom-96 left-6 z-20">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-[20rem] p-4 relative">
            <button
              className="absolute top-2 right-2 text-[var(--foreground)] hover:text-gray-500"
              onClick={() => setShowExtra(false)}
              aria-label="Cerrar monto adicional"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <h2 className="text-center font-semibold mb-2 text-[var(--foreground)] text-base">
              Monto Adicional
            </h2>
            <div className="border rounded-lg mb-3 h-10 flex items-center justify-end px-2 bg-[var(--input-bg)]">
              <input
                type="text"
                inputMode="numeric"
                value={
                  extraAmount === 0
                    ? ''
                    : currency === 'CRC'
                      ? formatCRC(extraAmount)
                      : formatUSD(extraAmount)
                }
                onChange={handleExtraChange}
                className="w-full px-2 py-1 border-none bg-transparent text-[var(--foreground)] text-right text-base focus:outline-none"
                placeholder="0"
              />
              <button
                onClick={handleExtraClear}
                className="ml-2 text-red-500 hover:text-red-700"
                aria-label="Borrar monto adicional"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            {/* Inputs adicionales */}
            <div className="mb-2">
              <label className="block text-[var(--foreground)] text-sm mb-1">Apertura de caja</label>
              <input
                type="number"
                min="0"
                value={aperturaCaja}
                onChange={e => setAperturaCaja(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-2 py-1 border rounded bg-[var(--input-bg)] text-[var(--foreground)] text-base focus:outline-none"
                placeholder="0"
              />
            </div>
            <div className="mb-2">
              <label className="block text-[var(--foreground)] text-sm mb-1">Venta actual</label>
              <input
                type="number"
                min="0"
                value={ventaActual}
                onChange={e => setVentaActual(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-2 py-1 border rounded bg-[var(--input-bg)] text-[var(--foreground)] text-base focus:outline-none"
                placeholder="0"
              />
            </div>
            {/* Mensaje de sobrante/faltante */}
            {aperturaCaja !== '' && ventaActual !== '' && (
              (() => {
                const montoRestante = computeTotal() - Number(ventaActual);
                const diferencia = Math.abs(montoRestante - Number(aperturaCaja));
                if (montoRestante > Number(aperturaCaja)) {
                  return <div className="mt-2 text-green-600 font-semibold text-center">Sobrante: {currency === 'CRC' ? formatCRC(diferencia) : formatUSD(diferencia)}</div>;
                } else if (montoRestante < Number(aperturaCaja)) {
                  return <div className="mt-2 text-red-600 font-semibold text-center">Faltante: {currency === 'CRC' ? formatCRC(diferencia) : formatUSD(diferencia)}</div>;
                } else {
                  return <div className="mt-2 text-[var(--foreground)] font-semibold text-center">Sin sobrante ni faltante</div>;
                }
              })()
            )}
          </div>
        </div>
      )}

      {/* Lista de denominaciones sin scroll interno */}
      <div className="space-y-4 mt-4 mb-32">
        {denominaciones.map((den) => {
          const count = bills[den.value] || 0;
          const subtotal = den.value * count;
          return (
            <div
              key={den.value}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg p-3 
                ${count === 0
                  ? 'border-2 border-gray-400'
                  : 'border-2 border-green-600'
                } bg-[var(--input-bg)]`}
            >
              {/* Denominación: centrado y con texto más pequeño en móvil */}
              <span className="text-[var(--foreground)] text-sm sm:text-base mb-2 sm:mb-0 sm:w-1/4 text-center sm:text-left">
                {den.label}
              </span>

              {/* Controles de cantidad y input manual */}
              <div className="flex items-center space-x-2 w-full sm:w-1/4 justify-center mb-2 sm:mb-0">
                <button
                  onClick={() => handleDecrement(den.value)}
                  className="p-2 bg-red-500 hover:bg-red-600 rounded-full"
                  aria-label={`Disminuir ${den.label}`}
                >
                  <MinusCircle className="w-6 h-6 text-white" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={count === 0 ? '' : String(count)}
                  onChange={(e) => handleManualChange(den.value, e.target.value)}
                  className="w-12 text-center bg-[var(--background)] border border-[var(--input-border)] rounded py-1 text-[var(--foreground)] text-sm"
                  placeholder="0"
                />
                <button
                  onClick={() => handleIncrement(den.value)}
                  className="p-2 bg-green-500 hover:bg-green-600 rounded-full"
                  aria-label={`Aumentar ${den.label}`}
                >
                  <PlusCircle className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Subtotal: alineado a la derecha en escritorio, centrado en móvil */}
              <span className="font-medium text-[var(--foreground)] text-sm sm:text-base sm:w-1/4 text-center sm:text-right">
                {currency === 'CRC' ? formatCRC(subtotal) : formatUSD(subtotal)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total fijo al fondo de la tarjeta */}
      <div className="fixed bottom-6 border-2 border-gray-600 left-1/2 transform -translate-x-1/2 w-[90%] bg-[var(--button-bg)] rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center shadow-lg z-10">
        <span className="text-lg font-semibold text-[var(--foreground)] text-center sm:text-left mb-2 sm:mb-0">
          Total:
        </span>
        {/* Mensaje de sobrante/faltante entre el total y el monto */}
        {aperturaCaja !== '' && ventaActual !== '' && (
          (() => {
            const montoRestante = computeTotal() - Number(ventaActual);
            const diferencia = Math.abs(montoRestante - Number(aperturaCaja));
            if (montoRestante > Number(aperturaCaja)) {
              return <span className="text-green-600 font-semibold text-center mx-2">Sobrante: {currency === 'CRC' ? formatCRC(diferencia) : formatUSD(diferencia)}</span>;
            } else if (montoRestante < Number(aperturaCaja)) {
              return <span className="text-red-600 font-semibold text-center mx-2">Faltante: {currency === 'CRC' ? formatCRC(diferencia) : formatUSD(diferencia)}</span>;
            } else {
              return <span className="text-[var(--foreground)] font-semibold text-center mx-2">Sin sobrante ni faltante</span>;
            }
          })()
        )}
        <span className="text-xl font-bold text-[var(--foreground)] text-center sm:text-right">
          {currency === 'CRC' ? formatCRC(computeTotal()) : formatUSD(computeTotal())}
        </span>
      </div>
    </div>
  );
}

type RenameModalProps = {
  isOpen: boolean;
  currentName: string;
  onSave: (newName: string) => void;
  onClose: () => void;
};

function RenameModal({ isOpen, currentName, onSave, onClose }: RenameModalProps) {
  const [newName, setNewName] = useState<string>(currentName);

  useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-[20rem] p-4 relative">
        <button
          className="absolute top-2 right-2 text-[var(--foreground)] hover:text-gray-500"
          onClick={onClose}
          aria-label="Cerrar renombrar"
        >
          <XCircle className="w-6 h-6" />
        </button>
        <h2 className="text-center font-semibold mb-2 text-[var(--foreground)] text-base">
          Renombrar Contador
        </h2>
        <div className="border rounded-lg mb-3 h-10 flex items-center justify-end px-2 bg-[var(--input-bg)]">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-2 py-1 border-none bg-transparent text-[var(--foreground)] text-right text-base focus:outline-none"
          />
        </div>
        <button
          onClick={() => {
            onSave(newName.trim() === '' ? currentName : newName);
            onClose();
          }}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

type CurrencyModalProps = {
  isOpen: boolean;
  currentCurrency: 'CRC' | 'USD';
  onSave: (newCurrency: 'CRC' | 'USD') => void;
  onClose: () => void;
};

function CurrencyModal({ isOpen, currentCurrency, onSave, onClose }: CurrencyModalProps) {
  const [selected, setSelected] = useState<'CRC' | 'USD'>(currentCurrency);

  useEffect(() => {
    setSelected(currentCurrency);
  }, [currentCurrency]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-[20rem] p-4 relative">
        <button
          className="absolute top-2 right-2 text-[var(--foreground)] hover:text-gray-500"
          onClick={onClose}
          aria-label="Cerrar moneda"
        >
          <XCircle className="w-6 h-6" />
        </button>
        <h2 className="text-center font-semibold mb-2 text-[var(--foreground)] text-base">
          Seleccionar Moneda
        </h2>
        <div className="flex justify-around mb-3">
          <button
            onClick={() => setSelected('CRC')}
            className={`px-4 py-2 rounded-lg ${selected === 'CRC'
              ? 'bg-purple-600 text-white'
              : 'bg-[var(--input-bg)] text-[var(--foreground)] hover:bg-[var(--button-hover)]'
              }`}
          >
            Colones (CRC)
          </button>
          <button
            onClick={() => setSelected('USD')}
            className={`px-4 py-2 rounded-lg ${selected === 'USD'
              ? 'bg-purple-600 text-white'
              : 'bg-[var(--input-bg)] text-[var(--foreground)] hover:bg-[var(--button-hover)]'
              }`}
          >
            Dólares (USD)
          </button>
        </div>
        <button
          onClick={() => {
            onSave(selected);
            onClose();
          }}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

export default function CashCounterTabs() {
  const [tabsData, setTabsData] = useState<CashCounterData[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);

  // Para renombrar
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameIndex, setRenameIndex] = useState<number>(0);

  // Para cambiar moneda
  const [currencyModalOpen, setCurrencyModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('cashCounters');
    if (saved) {
      const parsed: CashCounterData[] = JSON.parse(saved);
      const normalized = parsed.map((item, idx) => ({
        name: item.name || `Contador ${idx + 1}`,
        bills: item.bills,
        extraAmount: item.extraAmount,
        currency: item.currency,
      }));
      setTabsData(normalized);
      setActiveTab(0);
    } else {
      setTabsData([{ name: 'Contador 1', bills: {}, extraAmount: 0, currency: 'CRC' }]);
      setActiveTab(0);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('cashCounters', JSON.stringify(tabsData));
  }, [tabsData]);

  const addNewTab = () => {
    setTabsData((prev) => [
      ...prev,
      { name: `Contador ${prev.length + 1}`, bills: {}, extraAmount: 0, currency: 'CRC' },
    ]);
    setActiveTab(tabsData.length);
  };

  const deleteTab = (index: number) => {
    setTabsData((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
    if (activeTab === index) {
      setActiveTab(0);
    } else if (activeTab > index) {
      setActiveTab((prev) => prev - 1);
    }
  };

  const updateTab = (index: number, newData: CashCounterData) => {
    setTabsData((prev) => {
      const copy = [...prev];
      copy[index] = newData;
      return copy;
    });
  };

  const handleRenameSave = (newName: string) => {
    updateTab(renameIndex, { ...tabsData[renameIndex], name: newName });
  };

  const handleCurrencySave = (newCurrency: 'CRC' | 'USD') => {
    // Resetea contadores y extraAmount al cambiar moneda
    updateTab(activeTab, {
      ...tabsData[activeTab],
      currency: newCurrency,
      bills: {},
      extraAmount: 0,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[var(--background)] min-h-screen pb-32">
      <h1 className="text-2xl text-center font-bold mb-4 text-[var(--foreground)]">Cash Counter</h1>
      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {tabsData.map((tab, idx) => (
          <div key={idx} className="relative">
            <button
              onClick={() => setActiveTab(idx)}
              className={`px-4 py-2 rounded-full flex-shrink-0 text-sm font-medium flex items-center ${idx === activeTab
                ? 'bg-[var(--card-bg)] text-[var(--foreground)] shadow border-2 border-green-900'
                : 'bg-[var(--input-bg)] text-[var(--tab-text)] hover:bg-[var(--button-hover)] border-2 border-transparent'
                }`}
            >
              <span className="truncate w-[8rem] text-center">{tab.name}</span>
            </button>
            <button
              onClick={() => {
                setRenameIndex(idx);
                setRenameModalOpen(true);
              }}
              className="absolute top-1/2 left-[7.5rem] p-1 -translate-y-1/2 bg-transparent"
              aria-label={`Renombrar contador ${idx + 1}`}
            >
              <Edit3 className="w-5 h-5" />
            </button>
          </div>
        ))}
        <button
          onClick={addNewTab}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full flex-shrink-0 text-sm font-semibold flex items-center"
        >
          <PlusCircle className="w-5 h-5 mr-1" />
          Nuevo
        </button>
      </div>

      {/* Modal para renombrar */}
      <RenameModal
        isOpen={renameModalOpen}
        currentName={tabsData[renameIndex]?.name || ''}
        onSave={handleRenameSave}
        onClose={() => setRenameModalOpen(false)}
      />

      {/* Modal para seleccionar moneda */}
      <CurrencyModal
        isOpen={currencyModalOpen}
        currentCurrency={tabsData[activeTab]?.currency || 'CRC'}
        onSave={handleCurrencySave}
        onClose={() => setCurrencyModalOpen(false)}
      />

      <div className="border border-t-0 border-[var(--input-border)] bg-[var(--card-bg)] rounded-b-2xl p-4 min-h-[200px]">
        {tabsData.length > 0 ? (
          <CashCounter
            id={activeTab}
            data={tabsData[activeTab]}
            onUpdate={updateTab}
            onDelete={deleteTab}
            onCurrencyOpen={() => setCurrencyModalOpen(true)}
          />
        ) : (
          <div className="text-center text-[var(--foreground)] opacity-50 flex flex-col items-center">
            <Inbox className="w-12 h-12 mb-2" />
            <p>No hay contadores. Presiona “+ Nuevo” para crear uno.</p>
          </div>
        )}
      </div>

      {/* Botón para abrir modal de calculadora */}
      <button
        onClick={() => setIsCalcOpen(true)}
        className="fixed bottom-32 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-16 h-16 flex items-center justify-center text-3xl shadow-xl z-10"
        aria-label="Abrir calculadora"
      >
        <CalculatorIcon className="w-6 h-6" />
      </button>

      {/* Modal de calculadora */}
      <CalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />
    </div>
  );
}
