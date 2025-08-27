'use client';
import { useState, useEffect, useCallback } from 'react';
import { XCircle } from 'lucide-react';

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

type CalculadoraPerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CalculadoraPer({ isOpen, onClose }: CalculadoraPerProps) {
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

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Calculadora">
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
    </BaseModal>
  );
}
