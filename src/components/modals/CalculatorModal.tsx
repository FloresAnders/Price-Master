"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { X, Calculator as CalculatorIcon } from "lucide-react";

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  expression: string;
  result: string;
  timestamp: number;
}

export default function CalculatorModal({
  isOpen,
  onClose,
}: CalculatorModalProps) {
  const [display, setDisplay] = useState<string>("");
  const [operation, setOperation] = useState<string>("");
  const [result, setResult] = useState<string>("0");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lastWasOperator, setLastWasOperator] = useState(false);
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  const operators = useMemo(() => ["+", "-", "*", "/"], []);
  const isOperator = useCallback(
    (char: string) => operators.includes(char),
    [operators],
  );

  const safeEval = useCallback((expr: string): string => {
    try {
      if (/\/\s*0(?:[^0-9]|$)/.test(expr)) {
        return "No se puede dividir entre 0";
      }

      const evaluated = Function('"use strict"; return (' + expr + ")")();
      return typeof evaluated === "number"
        ? String(parseFloat(evaluated.toFixed(10)))
        : String(evaluated);
    } catch {
      return "Error";
    }
  }, []);

  const handleButtonClick = useCallback(
    (value: string) => {
      if (value === "AC") {
        setDisplay("");
        setOperation("");
        setResult("0");
        setLastWasOperator(false);
        return;
      }

      if (value === "⌫") {
        setDisplay((prev) => prev.slice(0, -1));
        setLastWasOperator(false);
        return;
      }

      if (value === "±") {
        if (!display) return;
        const num = parseFloat(display);
        if (!Number.isNaN(num)) {
          setDisplay(String(num * -1));
        }
        return;
      }

      if (value === "%") {
        if (!display) return;
        const num = parseFloat(display);
        if (!Number.isNaN(num)) {
          setDisplay(String(num / 100));
        }
        return;
      }

      if (value === "=") {
        if (display && operation) {
          const expr = `${result}${operation}${display}`;
          const calcResult = safeEval(expr);

          setHistory((prev) => [
            ...prev,
            { expression: expr, result: calcResult, timestamp: Date.now() },
          ]);

          setResult(calcResult);
          setDisplay("");
          setOperation("");
          setLastWasOperator(false);
        }
        return;
      }

      if (isOperator(value)) {
        if (lastWasOperator || !display) return;
        setOperation(value);
        setResult(display || "0");
        setDisplay("");
        setLastWasOperator(true);
        return;
      }

      if (value === ".") {
        if (!display.includes(".")) {
          setDisplay((prev) => (prev ? `${prev}.` : "0."));
        }
        return;
      }

      if (/^[0-9]$/.test(value)) {
        if (display === "0" && value !== "0") {
          setDisplay(value);
        } else if (display !== "0") {
          setDisplay((prev) => `${prev}${value}`);
        } else if (value === "0") {
          setDisplay("0");
        }
        setLastWasOperator(false);
      }
    },
    [display, isOperator, lastWasOperator, operation, result, safeEval],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Enter" || e.key === "=") {
        handleButtonClick("=");
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === "c") {
        handleButtonClick("AC");
        e.preventDefault();
        return;
      }

      if (e.key === "Backspace") {
        handleButtonClick("⌫");
        e.preventDefault();
        return;
      }

      if (e.key === "%") {
        handleButtonClick("%");
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleButtonClick, isOpen, onClose]);

  const handleMouseDown = (btn: string) => {
    setPressedBtn(btn);
  };

  const handleMouseUp = () => {
    setPressedBtn(null);
  };

  if (!isOpen) return null;

  const buttonLayout = [
    ["AC", "±", "%", "⌫"],
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "+"],
  ];

  const getButtonClass = (btn: string) => {
    const baseClass =
      "relative overflow-hidden rounded-lg font-medium transition-all duration-75 flex items-center justify-center";
    const isPressed = pressedBtn === btn;

    if (["AC", "⌫", "±", "%"].includes(btn)) {
      return `${baseClass} bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-800 ${isPressed ? "scale-95 shadow-inner" : "shadow"}`;
    }

    if (operators.includes(btn)) {
      return `${baseClass} bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-800 font-bold text-lg ${isPressed ? "scale-95 shadow-inner" : "shadow"}`;
    }

    return `${baseClass} bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white border border-slate-300 dark:border-slate-600 ${isPressed ? "scale-95 shadow-inner" : "shadow"}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="relative flex w-full max-w-5xl flex-col sm:flex-row items-start justify-center gap-4 overflow-visible">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-4 sm:p-6 relative border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalculatorIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              Calculadora
            </h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={displayRef}
            className="mb-5 sm:mb-6 p-4 sm:p-5 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-inner"
          >
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-2 h-5 flex items-center justify-end gap-1 overflow-hidden">
              <span className="truncate">{result}</span>
              <span className="text-cyan-600 dark:text-cyan-400 truncate">
                {operation}
              </span>
            </div>

            <div className="flex items-end justify-end text-right min-h-14 sm:min-h-16">
              <div className="text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white break-all tracking-tight flex items-end justify-end">
                <span>{display || result || "0"}</span>
                {display && (
                  <span className="ml-1 mb-1 inline-block h-[0.9em] w-[2px] bg-cyan-500 animate-pulse rounded-full" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {buttonLayout.map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-4 gap-2">
                {row.map((btn) => (
                  <button
                    key={btn}
                    onClick={() => handleButtonClick(btn)}
                    onMouseDown={() => handleMouseDown(btn)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`${getButtonClass(btn)} py-3 sm:py-4 text-base sm:text-lg min-h-12 sm:min-h-14 active:scale-95`}
                    style={{
                      gridColumn: btn === "0" ? "span 2" : "span 1",
                    }}
                  >
                    {btn}
                  </button>
                ))}
              </div>
            ))}

            <button
              onClick={() => {
                handleButtonClick("=");
                handleMouseUp();
              }}
              onMouseDown={() => handleMouseDown("=")}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl py-4 sm:py-5 font-bold text-lg sm:text-xl shadow-lg hover:shadow-xl transition-all duration-75 ${
                pressedBtn === "=" ? "scale-95 shadow-inner" : ""
              }`}
            >
              =
            </button>
          </div>

          {history.length > 0 && (
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-slate-900/40 hover:bg-slate-800/60 text-slate-300 hover:text-white transition-all duration-200 py-3 mt-4"
            >
              <span className="text-sm font-medium">
                Historial ({history.length})
              </span>

              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 transition-transform duration-200 ${
                  showHistory ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>

        {history.length > 0 && showHistory && (
          <div className="w-full sm:w-80 rounded-2xl border border-cyan-500/20 bg-slate-950/70 backdrop-blur-sm shadow-2xl overflow-hidden sm:mt-0 mt-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                Últimas operaciones
              </span>
              <button
                onClick={() => setHistory([])}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
              >
                Limpiar
              </button>
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              {history
                .slice(-5)
                .reverse()
                .map((entry, idx) => (
                  <button
                    key={`${entry.timestamp}-${idx}`}
                    onClick={() => setDisplay(entry.result)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-cyan-500/10 transition-colors border-b border-white/5 last:border-none"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-slate-400 truncate">
                        {entry.expression}
                      </span>
                      <span className="text-lg font-semibold text-white truncate">
                        {entry.result}
                      </span>
                    </div>

                    <div className="text-cyan-400 text-sm ml-3 flex-shrink-0">
                      ↺
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
