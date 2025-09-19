'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Calculator as CalculatorIcon } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState<string>('');

  const handleButtonClick = useCallback((value: string) => {
    if (value === '=') {
      try {
        // Safer evaluation than eval()
        const result = Function('"use strict"; return (' + display + ')')();
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
      <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-[20rem] p-4 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)] flex items-center gap-2">
            <CalculatorIcon className="w-5 h-5 text-blue-600" />
            Calculadora
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
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
              className="bg-[var(--input-bg)] hover:bg-[var(--hover-bg)] rounded py-2 text-sm text-[var(--foreground)] flex items-center justify-center transition-colors border border-[var(--input-border)]"
            >
              {btn}
            </button>
          ))}
          <button
            onClick={() => handleButtonClick('=')}
            className="col-span-4 bg-blue-600 hover:bg-blue-700 text-white rounded py-2 mt-1 text-sm transition-colors"
          >
            =
          </button>
        </div>
      </div>
      
      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}