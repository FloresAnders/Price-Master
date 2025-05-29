'use client'

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

// Componente del Toggle de Tema
function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg w-10 h-10"
        aria-label="Cargando tema"
        title="Cargando tema"
        style={{
          backgroundColor: 'var(--button-bg)',
        }}
      >
        {/* Placeholder mientras carga */}
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg transition-colors duration-200"
      aria-label="Cambiar tema"
      title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      style={{
        backgroundColor: 'var(--button-bg)',
        color: 'var(--button-text)',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--button-hover)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--button-bg)')}
    >
      {theme === 'dark' ? (
        // Icono de sol para tema claro
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#FBBF24' /* amarillo sol */ }}>
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        // Icono de luna para tema oscuro
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--foreground)' }}>
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

export default function Header() {
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    setDate(new Date().toLocaleDateString());
  }, []);

  return (
    <header
      className="shadow-sm border-b transition-colors duration-300"
      style={{
        backgroundColor: 'var(--background)',
        borderColor: 'var(--input-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--foreground)' }}
            >
              Price Master
            </h1>
            <span
              className="ml-2 text-sm px-2 py-1 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: 'var(--badge-bg)',
                color: 'var(--badge-text)',
              }}
            >
              v1.0
            </span>
          </div>
<<<<<<< Updated upstream
<<<<<<< Updated upstream

          <nav className="hidden md:flex space-x-8">
            <a
              href="#scanner"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Scanner
            </a>
            <a
              href="#calculator"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Calculator
            </a>
            <a
              href="#converter"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Converter
            </a>
          </nav>

          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString()}
=======
=======
>>>>>>> Stashed changes
          <div className="flex items-center space-x-3">
            <div
              className="text-sm"
              style={{ color: 'var(--tab-text)' }}
            >
              {date}
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
