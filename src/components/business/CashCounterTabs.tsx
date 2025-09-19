'use client';
import { useState, useEffect, useRef } from 'react';
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
  Plus,
  RefreshCw,
  Smartphone,
  FolderOpen,
  Save,
  RotateCcw,
  Lock as LockIcon,
  GripVertical,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { CalculatorModal } from '../modals';
/*Menu,*/
// Modal base component to reduce code duplication
type BaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

function BaseModal({ isOpen, onClose, title, children }: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--card-bg)] rounded-2xl shadow-xl w-full max-w-[20rem] p-4 relative">
        <button
          className="absolute top-2 right-2 text-[var(--foreground)] hover:text-gray-500"
          onClick={onClose}
          aria-label={`Cerrar ${title.toLowerCase()}`}
        >
          <XCircle className="w-6 h-6" />
        </button>
        <h2 className="text-center font-semibold mb-2 text-[var(--foreground)] text-base">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

type SinpeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currency: 'CRC' | 'USD';
};

function SinpeModal({ isOpen, onClose, currency }: SinpeModalProps) {
  const [montoActual, setMontoActual] = useState<number>(0);
  const [montoARecibir, setMontoARecibir] = useState<number>(0);

  // Cargar datos desde localStorage al inicializar
  useEffect(() => {
    const savedMontoActual = localStorage.getItem('sinpe-monto-actual');
    if (savedMontoActual) {
      const parsed = parseFloat(savedMontoActual);
      if (!isNaN(parsed)) {
        setMontoActual(parsed);
      }
    }
  }, []);

  // Guardar monto actual en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('sinpe-monto-actual', montoActual.toString());
  }, [montoActual]);

  const formatCurrency = (num: number, currency: 'CRC' | 'USD') => {
    return new Intl.NumberFormat(currency === 'CRC' ? 'es-CR' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(num);
  };

  const totalEsperado = montoActual + montoARecibir;

  const handleMontoActualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setMontoActual(value);
  };

  const handleMontoARecibirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setMontoARecibir(value);
  };

  const handleReload = () => {
    setMontoActual(totalEsperado);
    setMontoARecibir(0);
    // El localStorage se actualiza automáticamente por el useEffect
  };

  const handleClear = () => {
    setMontoActual(0);
    setMontoARecibir(0);
    // El localStorage se actualiza automáticamente por el useEffect
  };

  // Manejar paste en el campo de monto actual
  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    try {
      const pastedText = e.clipboardData.getData('text');
      // Extraer números del texto pegado
      const numbers = pastedText.replace(/[^\d.,]/g, '').replace(',', '.');
      const value = parseFloat(numbers);
      if (!isNaN(value)) {
        setMontoActual(value);
      }
    } catch (error) {
      console.error('Error al pegar:', error);
    }
  };

  // Permitir cerrar modal con ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Verificador SINPE">
      <div className="space-y-4">
        {/* Monto Actual */}
        <div>
          <label className="block text-[var(--foreground)] text-sm mb-2 font-medium">
            Monto Actual (pegar aquí)
          </label>
          <div className="border rounded-lg p-3 bg-[var(--input-bg)] flex items-center">
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoActual || ''}
              onChange={handleMontoActualChange}
              onPaste={handlePaste}
              className="w-full bg-transparent text-[var(--foreground)] text-right text-lg focus:outline-none"
              placeholder="0"
            />
          </div>
          <div className="text-xs text-[var(--foreground)] opacity-60 mt-1">
            {formatCurrency(montoActual, currency)}
          </div>
        </div>

        {/* Monto a Recibir */}
        <div>
          <label className="block text-[var(--foreground)] text-sm mb-2 font-medium">
            Monto a Recibir
          </label>
          <div className="border rounded-lg p-3 bg-[var(--input-bg)] flex items-center">
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoARecibir || ''}
              onChange={handleMontoARecibirChange}
              className="w-full bg-transparent text-[var(--foreground)] text-right text-lg focus:outline-none"
              placeholder="0"
            />
          </div>
          <div className="text-xs text-[var(--foreground)] opacity-60 mt-1">
            {formatCurrency(montoARecibir, currency)}
          </div>
        </div>

        {/* Total Esperado */}
        <div className="bg-[var(--background)] rounded-lg p-4 border-2 border-green-500">
          <label className="block text-[var(--foreground)] text-sm mb-2 font-medium text-center">
            Total Esperado
          </label>
          <div className="text-center">
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(totalEsperado, currency)}
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex space-x-2">
          <button
            onClick={handleReload}
            disabled={totalEsperado === 0}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg font-medium ${totalEsperado > 0
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
            title="Mover total a monto actual y limpiar monto a recibir"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Recargar
          </button>
          <button
            onClick={handleClear}
            className="flex-1 flex items-center justify-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            title="Limpiar todos los campos"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Limpiar
          </button>
        </div>

        {/* Instrucciones */}
        <div className="text-xs text-[var(--foreground)] opacity-75 text-center mt-4 p-3 bg-[var(--input-bg)] rounded-lg">
          <p className="mb-1">💡 <strong>Instrucciones:</strong></p>
          <p className="mb-1">• Pega el monto actual desde SINPE en el primer campo</p>
          <p className="mb-1">• Ingresa el monto que vas a recibir</p>
          <p>• Usa &quot;Recargar&quot; para actualizar y continuar</p>
        </div>
      </div>
    </BaseModal>
  );
}

type BillsMap = Record<number, number>;

type CashCounterData = {
  name: string;
  bills: BillsMap;
  extraAmount: number;
  currency: 'CRC' | 'USD';
  aperturaCaja: number;
  ventaActual: number;
};

type CashCounterProps = {
  id: number;
  data: CashCounterData;
  onUpdate: (index: number, newData: CashCounterData) => void;
  onDelete: (index: number) => void;
  onCurrencyOpen: () => void;
};

function CashCounter({ id, data, onUpdate, onDelete, onCurrencyOpen }: CashCounterProps) {
  // CSS Constants
  const BUTTON_STYLES = {
    increment: "p-2 bg-green-500 hover:bg-green-600 rounded-full",
    decrement: "p-2 bg-red-500 hover:bg-red-600 rounded-full",
    iconPrimary: "text-blue-500 hover:text-blue-700",
    iconSecondary: "text-green-600 hover:text-green-800",
    iconDanger: "text-red-500 hover:text-red-700",
    iconWarning: "text-yellow-500 hover:text-yellow-700",
    modal: "bg-green-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl",
    close: "absolute top-2 right-2 text-[var(--foreground)] hover:text-gray-500"
  };

  const INPUT_STYLES = {
    counter: "w-12 text-center bg-[var(--background)] border border-[var(--input-border)] rounded py-1 text-[var(--foreground)] text-sm",
    modal: "w-full px-2 py-1 border-none bg-transparent text-[var(--foreground)] text-right text-base focus:outline-none",
    standard: "w-full px-2 py-1 border rounded bg-[var(--input-bg)] text-[var(--foreground)] text-base focus:outline-none"
  };
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
  const [aperturaCaja, setAperturaCaja] = useState<number>(data.aperturaCaja);
  const [ventaActual, setVentaActual] = useState<number>(data.ventaActual);
  const [nuevaVenta, setNuevaVenta] = useState<number>(0);
  const [ventaAgregada, setVentaAgregada] = useState<boolean>(false);
  const [showBillBreakdown, setShowBillBreakdown] = useState<boolean>(false);

  // Ref para navegar entre inputs de denominaciones
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Función para manejar navegación con ENTER, TAB y flechas, y sumar/restar con +/-
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    const denomination = denominaciones[currentIndex];

    // Manejar teclas + y - para incrementar/decrementar
    if (e.key === '+') {
      e.preventDefault();
      handleIncrement(denomination.value);
      return;
    }

    if (e.key === '-') {
      e.preventDefault();
      handleDecrement(denomination.value);
      return;
    }

    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowDown') {
      e.preventDefault();

      if (e.shiftKey && (e.key === 'Enter' || e.key === 'Tab')) {
        // Shift+Enter/Shift+Tab: ir al input anterior
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0 && inputRefs.current[prevIndex]) {
          inputRefs.current[prevIndex]?.focus();
        } else {
          // Si es el primer input, ir al último
          const lastIndex = denominaciones.length - 1;
          inputRefs.current[lastIndex]?.focus();
        }
      } else {
        // Enter/Tab/ArrowDown: ir al siguiente input
        const nextIndex = currentIndex + 1;
        if (nextIndex < denominaciones.length && inputRefs.current[nextIndex]) {
          inputRefs.current[nextIndex]?.focus();
        } else {
          // Si es el último input, volver al primero
          inputRefs.current[0]?.focus();
        }
      }
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      // ArrowUp: ir al input anterior
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0 && inputRefs.current[prevIndex]) {
        inputRefs.current[prevIndex]?.focus();
      } else {
        // Si es el primer input, ir al último
        const lastIndex = denominaciones.length - 1;
        inputRefs.current[lastIndex]?.focus();
      }
    }
  };

  // Sincronizar props → estado interno
  useEffect(() => {
    setBills({ ...data.bills });
    setExtraAmount(data.extraAmount);
    setCurrency(data.currency);
    setAperturaCaja(data.aperturaCaja);
    setVentaActual(data.ventaActual);
  }, [data]);

  // Inicializar array de refs cuando cambien las denominaciones
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, denominaciones.length);
  }, [denominaciones.length]);

  // Notificar al padre cuando cambia algún valor
  const notifyParent = (newBills: BillsMap, newExtra: number, newCurrency: 'CRC' | 'USD', newApertura?: number, newVenta?: number) => {
    onUpdate(id, {
      ...data,
      bills: newBills,
      extraAmount: newExtra,
      currency: newCurrency,
      aperturaCaja: newApertura !== undefined ? newApertura : aperturaCaja,
      ventaActual: newVenta !== undefined ? newVenta : ventaActual,
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

  const formatCurrency = (num: number, currency: 'CRC' | 'USD') => {
    return new Intl.NumberFormat(currency === 'CRC' ? 'es-CR' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(num);
  };

  const calculateBillBreakdown = () => {
    if (currency === 'CRC') {
      const bills20y10 = (bills[20000] || 0) * 20000 + (bills[10000] || 0) * 10000;
      const bills20_10_5 = bills20y10 + (bills[5000] || 0) * 5000;
      const bills2y1 = (bills[2000] || 0) * 2000 + (bills[1000] || 0) * 1000;
      const monedas = (bills[500] || 0) * 500 + (bills[100] || 0) * 100 + (bills[50] || 0) * 50 + (bills[25] || 0) * 25;

      return {
        bills20y10,
        bills20_10_5,
        bills2y1,
        monedas
      };
    } else {
      // Para USD
      const bills20y10 = (bills[20] || 0) * 20 + (bills[10] || 0) * 10;
      const bills20_10_5 = bills20y10 + (bills[5] || 0) * 5;
      const bills2y1 = 0; // USD no tiene billetes de 2, solo de 1
      const monedas = (bills[1] || 0) * 1; // En USD, $1 puede considerarse como "moneda" grande

      return {
        bills20y10,
        bills20_10_5,
        bills2y1,
        monedas
      };
    }
  };

  const calculateDifference = () => {
    if (aperturaCaja === 0 && ventaActual === 0) return null;

    const montoRestante = computeTotal() - ventaActual;
    const diferencia = Math.abs(montoRestante - aperturaCaja);

    if (montoRestante > aperturaCaja) {
      return { type: 'sobrante', amount: diferencia };
    } else if (montoRestante < aperturaCaja) {
      return { type: 'faltante', amount: diferencia };
    } else {
      return { type: 'equilibrio', amount: 0 };
    }
  };

  const renderDifferenceMessage = (className = 'text-center mx-2') => {
    const diff = calculateDifference();
    if (!diff) return null;

    const colorClass = diff.type === 'sobrante' ? 'text-green-600' :
      diff.type === 'faltante' ? 'text-red-600' : 'text-[var(--foreground)]';

    const message = diff.type === 'sobrante' ? `Sobrante: ${formatCurrency(diff.amount, currency)}` :
      diff.type === 'faltante' ? `Faltante: ${formatCurrency(diff.amount, currency)}` :
        'Sin sobrante ni faltante';

    return <span className={`${colorClass} font-semibold ${className}`}>{message}</span>;
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

  const handleAperturaCajaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setAperturaCaja(value);
    notifyParent(bills, extraAmount, currency, value, ventaActual);
  };

  const handleVentaActualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setVentaActual(value);
    notifyParent(bills, extraAmount, currency, aperturaCaja, value);
  };

  const handleNuevaVentaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : Number(e.target.value);
    setNuevaVenta(value);
  };

  const agregarVenta = () => {
    if (nuevaVenta > 0) {
      const nuevaVentaTotal = ventaActual + nuevaVenta;
      setVentaActual(nuevaVentaTotal);
      setNuevaVenta(0); // Limpiar el input

      // Mostrar feedback visual
      setVentaAgregada(true);
      setTimeout(() => setVentaAgregada(false), 2000);

      notifyParent(bills, extraAmount, currency, aperturaCaja, nuevaVentaTotal);
    }
  };

  // Función para manejar teclas + y - en inputs numéricos
  const handleNumericKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    value: number,
    setValue: (value: number) => void,
    increment: number = 1
  ) => {
    if (e.key === '+') {
      e.preventDefault();
      const newValue = value + increment;
      setValue(newValue);
    } else if (e.key === '-') {
      e.preventDefault();
      const newValue = Math.max(value - increment, 0);
      setValue(newValue);
    }
  };

  // Manejadores específicos para cada input
  const handleExtraAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const increment = currency === 'CRC' ? 1000 : 1;
    handleNumericKeyDown(e, extraAmount, (newValue) => {
      setExtraAmount(newValue);
      notifyParent(bills, newValue, currency);
    }, increment);
  };

  const handleAperturaCajaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const increment = currency === 'CRC' ? 1000 : 1;
    handleNumericKeyDown(e, aperturaCaja, (newValue) => {
      setAperturaCaja(newValue);
      notifyParent(bills, extraAmount, currency, newValue, ventaActual);
    }, increment);
  };

  const handleVentaActualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const increment = currency === 'CRC' ? 1000 : 1;
    handleNumericKeyDown(e, ventaActual, (newValue) => {
      setVentaActual(newValue);
      notifyParent(bills, extraAmount, currency, aperturaCaja, newValue);
    }, increment);
  };

  const handleNuevaVentaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      agregarVenta();
      return;
    }
    const increment = currency === 'CRC' ? 1000 : 1;
    handleNumericKeyDown(e, nuevaVenta, setNuevaVenta, increment);
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
                setAperturaCaja(0);
                setVentaActual(0);
                setNuevaVenta(0);
                notifyParent(resetBills, 0, currency, 0, 0);
              }
            }}
            className={BUTTON_STYLES.iconWarning}
            aria-label="Limpiar todos los montos"
          >
            <Eraser className="w-6 h-6" />
          </button>
          {/* ...existing code... */}
          <button
            onClick={() => {
              const content = JSON.stringify({
                name: data.name,
                bills,
                extraAmount,
                currency,
                aperturaCaja,
                ventaActual
              });
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
          {/* ...existing code... */}
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
                      setAperturaCaja(parsed.aperturaCaja || 0);
                      setVentaActual(parsed.ventaActual || 0);
                      notifyParent(parsed.bills, parsed.extraAmount, parsed.currency, parsed.aperturaCaja || 0, parsed.ventaActual || 0);
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

      {/* Sección de resumen de caja */}
      {(aperturaCaja > 0 && ventaActual > 0) && (
        <div className="bg-[var(--input-bg)] rounded-lg p-3 mb-4 border border-[var(--input-border)]">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-2 text-center">Resumen de Caja</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <span className="block text-[var(--foreground)] opacity-75">Apertura</span>
              <span className="font-medium text-[var(--foreground)]">
                {formatCurrency(aperturaCaja, currency)}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-[var(--foreground)] opacity-75">Venta</span>
              <span className="font-medium text-[var(--foreground)]">
                {formatCurrency(ventaActual, currency)}
              </span>
            </div>
          </div>
          {/* Mostrar diferencia si hay valores */}
          <div className="mt-2 text-center border-t border-[var(--input-border)] pt-2">
            {renderDifferenceMessage('text-center')}
          </div>
        </div>
      )}

      {/* Checkbox para mostrar desglose de billetes */}
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showBillBreakdown}
            onChange={(e) => setShowBillBreakdown(e.target.checked)}
            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="text-[var(--foreground)] text-sm font-medium">
            Mostrar desglose por tipos de billetes
          </span>
        </label>
      </div>

      {/* Desglose de billetes */}
      {showBillBreakdown && (
        <div className="bg-[var(--input-bg)] rounded-lg p-3 mb-4 border border-[var(--input-border)]">
          <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3 text-center">
            Desglose por Tipos de Billetes
          </h4>
          {(() => {
            const breakdown = calculateBillBreakdown();
            return (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center p-2 bg-[var(--background)] rounded">
                  <span className="block text-[var(--foreground)] opacity-75 mb-1">
                    {currency === 'CRC' ? '₡20k + ₡10k' : '$20 + $10'}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {formatCurrency(breakdown.bills20y10, currency)}
                  </span>
                </div>
                <div className="text-center p-2 bg-[var(--background)] rounded">
                  <span className="block text-[var(--foreground)] opacity-75 mb-1">
                    {currency === 'CRC' ? '₡20k + ₡10k + ₡5k' : '$20 + $10 + $5'}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {formatCurrency(breakdown.bills20_10_5, currency)}
                  </span>
                </div>
                {currency === 'CRC' && (
                  <>
                    <div className="text-center p-2 bg-[var(--background)] rounded">
                      <span className="block text-[var(--foreground)] opacity-75 mb-1">
                        ₡2k + ₡1k
                      </span>
                      <span className="font-medium text-[var(--foreground)]">
                        {formatCurrency(breakdown.bills2y1, currency)}
                      </span>
                    </div>
                    <div className="text-center p-2 bg-[var(--background)] rounded">
                      <span className="block text-[var(--foreground)] opacity-75 mb-1">
                        Monedas
                      </span>
                      <span className="font-medium text-[var(--foreground)]">
                        {formatCurrency(breakdown.monedas, currency)}
                      </span>
                    </div>
                  </>
                )}
                {currency === 'USD' && (
                  <div className="text-center p-2 bg-[var(--background)] rounded col-span-2">
                    <span className="block text-[var(--foreground)] opacity-75 mb-1">
                      Billetes de $1
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {formatCurrency(breakdown.monedas, currency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

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
                    : formatCurrency(extraAmount, currency)
                }
                onChange={handleExtraChange}
                onKeyDown={handleExtraAmountKeyDown}
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
                value={aperturaCaja || ''}
                onChange={handleAperturaCajaChange}
                onKeyDown={handleAperturaCajaKeyDown}
                className="w-full px-2 py-1 border rounded bg-[var(--input-bg)] text-[var(--foreground)] text-base focus:outline-none"
                placeholder="0"
              />
            </div>
            <div className="mb-2">
              <label className="block text-[var(--foreground)] text-sm mb-1">Venta actual</label>
              <input
                type="number"
                min="0"
                value={ventaActual || ''}
                onChange={handleVentaActualChange}
                onKeyDown={handleVentaActualKeyDown}
                className="w-full px-2 py-1 border rounded bg-[var(--input-bg)] text-[var(--foreground)] text-base focus:outline-none"
                placeholder="0"
              />
            </div>

            {/* Nueva sección para agregar venta */}
            <div className="mb-2">
              <label className="block text-[var(--foreground)] text-sm mb-1">Agregar venta</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  min="0"
                  value={nuevaVenta || ''}
                  onChange={handleNuevaVentaChange}
                  onKeyDown={handleNuevaVentaKeyDown}
                  className="w-28 px-2 py-1 border rounded bg-[var(--input-bg)] text-[var(--foreground)] text-base focus:outline-none"
                  placeholder="0"
                />
                <button
                  onClick={agregarVenta}
                  disabled={nuevaVenta <= 0}
                  className={`px-3 py-1 rounded text-sm font-medium flex items-center whitespace-nowrap ${nuevaVenta > 0
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    }`}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </button>
              </div>
              {nuevaVenta > 0 && (
                <div className="mt-1 text-xs text-[var(--foreground)] opacity-75">
                  Total después: {formatCurrency(ventaActual + nuevaVenta, currency)}
                </div>
              )}
              {ventaAgregada && (
                <div className="mt-1 text-xs text-green-600 font-medium animate-pulse">
                  ✓ Venta agregada correctamente
                </div>
              )}
            </div>
            {/* Mensaje de sobrante/faltante */}
            {renderDifferenceMessage('mt-2 text-center')}
          </div>
        </div>
      )}

      {/* Lista de denominaciones sin scroll interno */}
      <div className="space-y-4 mt-4 mb-32">
        {denominaciones.map((den, index) => {
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
                  className={BUTTON_STYLES.decrement}
                  aria-label={`Disminuir ${den.label}`}
                >
                  <MinusCircle className="w-6 h-6 text-white" />
                </button>
                <input
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  value={count === 0 ? '' : String(count)}
                  onChange={(e) => handleManualChange(den.value, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={INPUT_STYLES.counter}
                  placeholder="0"
                />
                <button
                  onClick={() => handleIncrement(den.value)}
                  className={BUTTON_STYLES.increment}
                  aria-label={`Aumentar ${den.label}`}
                >
                  <PlusCircle className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Subtotal: alineado a la derecha en escritorio, centrado en móvil */}
              <span className="font-medium text-[var(--foreground)] text-sm sm:text-base sm:w-1/4 text-center sm:text-right">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total: se mantiene dentro de la tarjeta y se fija al fondo cuando se llega al final */}
      <div className="sticky bottom-6 border-2 border-gray-600 w-[90%] mx-auto bg-[var(--button-bg)] rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center shadow-lg z-10">
        <span className="text-lg font-semibold text-[var(--foreground)] text-center sm:text-left mb-2 sm:mb-0">
          Total:
        </span>
        {/* Mensaje de sobrante/faltante entre el total y el monto */}
        {renderDifferenceMessage()}
        <span className="text-xl font-bold text-[var(--foreground)] text-center sm:text-right">
          {formatCurrency(computeTotal(), currency)}
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNewName(currentName);
  }, [currentName]);

  // Seleccionar todo el texto cuando se abre el modal
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Pequeño delay para asegurar que el modal esté completamente renderizado
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  // Manejar tecla Enter para guardar
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(newName.trim() === '' ? currentName : newName);
      onClose();
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Renombrar Contador">
      <div className="border rounded-lg mb-3 h-10 flex items-center justify-end px-2 bg-[var(--input-bg)]">
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
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
    </BaseModal>
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

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Seleccionar Moneda">
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
    </BaseModal>
  );
}

type MenuModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
  storageInfo: string;
};

function MenuModal({ isOpen, onClose, onExport, onImport, onClear, storageInfo }: MenuModalProps) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Gestión de Datos">
      <div className="space-y-3">
        {/* Información de almacenamiento */}
        <div className="bg-[var(--input-bg)] rounded-lg p-3 text-center">
          <span className="text-xs text-[var(--foreground)] opacity-75">
            {storageInfo}
          </span>
        </div>

        {/* Botón de exportar */}
        <button
          onClick={() => {
            onExport();
            onClose();
          }}
          className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          <Save className="w-5 h-5 mr-2" />
          Exportar Respaldo
        </button>

        {/* Botón de importar */}
        <button
          onClick={() => {
            onImport();
            onClose();
          }}
          className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
        >
          <FolderOpen className="w-5 h-5 mr-2" />
          Importar Respaldo
        </button>

        {/* Botón de limpiar */}
        <button
          onClick={() => {
            onClear();
            onClose();
          }}
          className="w-full flex items-center justify-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Restablecer Todo
        </button>
      </div>
    </BaseModal>
  );
}

export default function CashCounterTabs() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [tabsData, setTabsData] = useState<CashCounterData[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isCalcOpen, setIsCalcOpen] = useState<boolean>(false);
  const [isSinpeOpen, setIsSinpeOpen] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Para renombrar
  const [renameModalOpen, setRenameModalOpen] = useState<boolean>(false);
  const [renameIndex, setRenameIndex] = useState<number>(0);

  // Para cambiar moneda
  const [currencyModalOpen, setCurrencyModalOpen] = useState<boolean>(false);

  // Para el menú de gestión de datos
  const [menuModalOpen, setMenuModalOpen] = useState<boolean>(false);

  // Para drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Función para guardar en localStorage con manejo de errores
  const saveToLocalStorage = async (data: CashCounterData[], activeTabIndex: number) => {
    setIsSaving(true);
    try {
      const saveData = {
        counters: data,
        activeTab: activeTabIndex,
        lastSaved: new Date().toISOString()
      };
      window.localStorage.setItem('cashCounters', JSON.stringify(saveData));
      setLastSaved(new Date().toLocaleTimeString());
      console.log('✅ Datos guardados en localStorage:', saveData);

      // Simular un pequeño delay para mostrar el indicador de guardado
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error guardando en localStorage:', error);
      alert('Error al guardar los datos. Verifica el espacio de almacenamiento.');
    } finally {
      setIsSaving(false);
    }
  };

  // Función para cargar desde localStorage con manejo de errores
  const loadFromLocalStorage = () => {
    try {
      const saved = window.localStorage.getItem('cashCounters');
      if (saved) {
        const parsedData = JSON.parse(saved);

        // Compatibilidad con formato anterior
        let counters: CashCounterData[];
        let activeTabIndex = 0;

        if (Array.isArray(parsedData)) {
          // Formato anterior: solo array de contadores
          counters = parsedData;
        } else if (parsedData.counters) {
          // Formato nuevo: objeto con contadores y pestaña activa
          counters = parsedData.counters;
          activeTabIndex = parsedData.activeTab || 0;
        } else {
          throw new Error('Formato de datos no válido');
        }

        const normalized = counters.map((item, idx) => ({
          name: item.name || `Contador ${idx + 1}`,
          bills: item.bills || {},
          extraAmount: item.extraAmount || 0,
          currency: (item.currency as 'CRC' | 'USD') || 'CRC',
          aperturaCaja: item.aperturaCaja || 0,
          ventaActual: item.ventaActual || 0,
        }));

        setTabsData(normalized);
        setActiveTab(Math.min(activeTabIndex, normalized.length - 1));
        console.log('✅ Datos cargados desde localStorage:', { counters: normalized, activeTab: activeTabIndex });
      } else {
        // Datos por defecto si no hay nada guardado
        const defaultData = [{
          name: 'Contador 1',
          bills: {},
          extraAmount: 0,
          currency: 'CRC' as 'CRC' | 'USD',
          aperturaCaja: 0,
          ventaActual: 0
        }];
        setTabsData(defaultData);
        setActiveTab(0);
        saveToLocalStorage(defaultData, 0);
      }
    } catch (error) {
      console.error('❌ Error cargando desde localStorage:', error);
      // Datos por defecto en caso de error
      const defaultData = [{
        name: 'Contador 1',
        bills: {},
        extraAmount: 0,
        currency: 'CRC' as 'CRC' | 'USD',
        aperturaCaja: 0,
        ventaActual: 0
      }];
      setTabsData(defaultData);
      setActiveTab(0);
      alert('Error al cargar los datos guardados. Se han restablecido los valores por defecto.');
    }
  };

  // Cargar datos al iniciar
  useEffect(() => {
    loadFromLocalStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar datos cuando cambien
  useEffect(() => {
    if (tabsData.length > 0) {
      saveToLocalStorage(tabsData, activeTab);
    }
  }, [tabsData, activeTab]);

  const addNewTab = () => {
    const newTab = {
      name: `Contador ${tabsData.length + 1}`,
      bills: {},
      extraAmount: 0,
      currency: 'CRC' as 'CRC' | 'USD',
      aperturaCaja: 0,
      ventaActual: 0
    };
    const newTabsData = [...tabsData, newTab];
    const newActiveTab = tabsData.length;

    setTabsData(newTabsData);
    setActiveTab(newActiveTab);
    saveToLocalStorage(newTabsData, newActiveTab);
  };

  const deleteTab = (index: number) => {
    if (tabsData.length <= 1) {
      alert('No puedes eliminar el último contador. Debe haber al menos uno.');
      return;
    }

    const newTabsData = tabsData.filter((_, idx) => idx !== index);
    let newActiveTab = activeTab;

    if (activeTab === index) {
      newActiveTab = 0;
    } else if (activeTab > index) {
      newActiveTab = activeTab - 1;
    }

    setTabsData(newTabsData);
    setActiveTab(newActiveTab);
    saveToLocalStorage(newTabsData, newActiveTab);
  };

  const updateTab = (index: number, newData: CashCounterData) => {
    const newTabsData = [...tabsData];
    newTabsData[index] = newData;
    setTabsData(newTabsData);
    saveToLocalStorage(newTabsData, activeTab);
  };

  // Funciones para drag and drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');

    // Agregar una imagen fantasma personalizada
    const dragImage = document.createElement('div');
    dragImage.textContent = tabsData[index].name;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.background = 'var(--card-bg)';
    dragImage.style.padding = '8px 16px';
    dragImage.style.borderRadius = '9999px';
    dragImage.style.fontSize = '14px';
    dragImage.style.color = 'var(--foreground)';
    dragImage.style.border = '2px solid #059669';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 50, 20);

    // Remover el elemento después de un breve delay
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Solo limpiar si realmente estamos saliendo del contenedor
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newTabsData = [...tabsData];
    const draggedTab = newTabsData[draggedIndex];

    // Remover el elemento de su posición original
    newTabsData.splice(draggedIndex, 1);

    // Insertar en la nueva posición
    newTabsData.splice(dropIndex, 0, draggedTab);

    // Actualizar el índice de la pestaña activa
    let newActiveTab = activeTab;
    if (activeTab === draggedIndex) {
      newActiveTab = dropIndex;
    } else if (activeTab > draggedIndex && activeTab <= dropIndex) {
      newActiveTab = activeTab - 1;
    } else if (activeTab < draggedIndex && activeTab >= dropIndex) {
      newActiveTab = activeTab + 1;
    }

    setTabsData(newTabsData);
    setActiveTab(newActiveTab);
    saveToLocalStorage(newTabsData, newActiveTab);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Función para exportar todos los datos a un archivo JSON
  const exportAllData = () => {
    try {
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        counters: tabsData,
        activeTab: activeTab
      };

      const content = JSON.stringify(exportData, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-counter-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando datos:', error);
      alert('Error al exportar los datos.');
    }
  };

  // Función para importar todos los datos desde un archivo JSON
  const importAllData = () => {
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
          const importData = JSON.parse(ev.target?.result as string);

          if (importData.counters && Array.isArray(importData.counters)) {
            const normalized = importData.counters.map((item: unknown, idx: number) => {
              const counterItem = item as Record<string, unknown>;
              return {
                name: (typeof counterItem.name === 'string' ? counterItem.name : null) || `Contador ${idx + 1}`,
                bills: (typeof counterItem.bills === 'object' && counterItem.bills !== null ? counterItem.bills : {}) as BillsMap,
                extraAmount: (typeof counterItem.extraAmount === 'number' ? counterItem.extraAmount : null) || 0,
                currency: (counterItem.currency === 'CRC' || counterItem.currency === 'USD' ? counterItem.currency : 'CRC') as 'CRC' | 'USD',
                aperturaCaja: (typeof counterItem.aperturaCaja === 'number' ? counterItem.aperturaCaja : null) || 0,
                ventaActual: (typeof counterItem.ventaActual === 'number' ? counterItem.ventaActual : null) || 0,
              };
            });

            const newActiveTab = Math.min(importData.activeTab || 0, normalized.length - 1);

            setTabsData(normalized);
            setActiveTab(newActiveTab);
            saveToLocalStorage(normalized, newActiveTab);

            alert(`✅ Datos importados correctamente. ${normalized.length} contadores cargados.`);
          } else {
            alert('❌ Formato de archivo no válido para importar.');
          }
        } catch (error) {
          console.error('Error importando datos:', error);
          alert('❌ Error al procesar el archivo de importación.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Función para obtener información de almacenamiento
  const getStorageInfo = () => {
    try {
      const data = window.localStorage.getItem('cashCounters');
      if (data) {
        const sizeInBytes = new Blob([data]).size;
        const sizeInKB = (sizeInBytes / 1024).toFixed(2);
        const countersCount = tabsData.length;
        return `${countersCount} contadores • ${sizeInKB} KB`;
      }
      return 'Sin datos guardados';
    } catch {
      return 'Error obteniendo información';
    }
  };

  // Función para limpiar todos los datos del localStorage
  const clearAllData = () => {
    const storageInfo = getStorageInfo();
    if (confirm(`⚠️ ¿Estás seguro de que quieres borrar TODOS los datos guardados?\n\nDatos actuales: ${storageInfo}\n\nEsta acción no se puede deshacer.`)) {
      try {
        window.localStorage.removeItem('cashCounters');
        const defaultData = [{
          name: 'Contador 1',
          bills: {},
          extraAmount: 0,
          currency: 'CRC' as 'CRC' | 'USD',
          aperturaCaja: 0,
          ventaActual: 0
        }];
        setTabsData(defaultData);
        setActiveTab(0);
        saveToLocalStorage(defaultData, 0);
        alert('✅ Todos los datos han sido borrados y restablecidos.');
      } catch (error) {
        console.error('Error limpiando datos:', error);
        alert('❌ Error al limpiar los datos.');
      }
    }
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
      aperturaCaja: 0,
      ventaActual: 0,
    });
  };

  // Verificar si el usuario tiene permiso para usar el contador de efectivo
  if (!hasPermission(user?.permissions, 'cashcounter')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Contador de Efectivo.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-[var(--background)] min-h-screen pb-32">
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Cash Counter</h1>
      </div>

      <div className="flex justify-end items-center mb-4">
        <div className="flex items-center space-x-3">
          {/* Indicador de guardado */}
          <div className="flex items-center text-sm">
            {isSaving ? (
              <span className="text-blue-500 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Guardando...
              </span>
            ) : lastSaved ? (
              <span className="text-green-600 flex items-center">
                ✓ Guardado {lastSaved}
              </span>
            ) : null}
          </div>

          {/* Botón de menú 
          <button
            onClick={() => setMenuModalOpen(true)}
            className="p-2 text-[var(--foreground)] hover:text-blue-600 hover:bg-[var(--button-hover)] rounded-lg transition-colors"
            aria-label="Abrir menú de gestión"
          >
            <Menu className="w-6 h-6" />
          </button>*/}
        </div>
      </div>



      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {tabsData.map((tab, idx) => (
          <div
            key={idx}
            className={`relative transition-all duration-200 ${dragOverIndex === idx && draggedIndex !== idx
              ? 'transform scale-105 shadow-lg border-2 border-blue-400 border-dashed rounded-full'
              : ''
              } ${draggedIndex === idx
                ? 'opacity-50 transform rotate-2'
                : ''
              }`}
            draggable={tabsData.length > 1}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={(e) => handleDragLeave(e)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
          >
            {/* Icono de grip para arrastrar */}
            <div
              className={`absolute left-1 top-1/2 -translate-y-1/2 z-10 ${tabsData.length > 1
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-not-allowed opacity-50'
                }`}
              title={tabsData.length > 1 ? "Arrastra para reordenar" : "Necesitas al menos 2 contadores para reordenar"}
            >
              <GripVertical className={`w-4 h-4 transition-colors ${tabsData.length > 1
                ? 'text-gray-400 hover:text-gray-600'
                : 'text-gray-300'
                }`} />
            </div>

            <button
              onClick={() => {
                setActiveTab(idx);
                saveToLocalStorage(tabsData, idx);
              }}
              className={`pl-8 pr-10 py-2 rounded-full flex-shrink-0 text-sm font-medium flex items-center transition-all duration-200 ${idx === activeTab
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
              className="absolute top-1/2 right-1 p-1 -translate-y-1/2 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 rounded z-10 transition-colors"
              aria-label={`Renombrar contador ${idx + 1}`}
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={addNewTab}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full flex-shrink-0 text-sm font-semibold flex items-center transition-colors"
        >
          <PlusCircle className="w-5 h-5 mr-1" />
          Nuevo
        </button>
      </div>

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

      {/* Botón para abrir modal de verificar sinpe */}
      <button
        onClick={() => setIsSinpeOpen(true)}
        className="fixed bottom-52 right-6 bg-green-600 hover:bg-green-700 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl z-10"
        aria-label="Abrir verificador SINPE"
      >
        <Smartphone className="w-6 h-6" />
      </button>

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

      {/* Modal de verificador SINPE */}
      <SinpeModal
        isOpen={isSinpeOpen}
        onClose={() => setIsSinpeOpen(false)}
        currency={tabsData[activeTab]?.currency || 'CRC'}
      />

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

      {/* Modal de gestión de datos */}
      <MenuModal
        isOpen={menuModalOpen}
        onClose={() => setMenuModalOpen(false)}
        onExport={exportAllData}
        onImport={importAllData}
        onClear={clearAllData}
        storageInfo={getStorageInfo()}
      />
    </div>
  );
}
