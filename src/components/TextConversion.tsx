'use client'; 
import React, { useState } from 'react';
import { Lock as LockIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';

export default function TextConversion() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const copyToClipboard = async (value: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipboardText = await navigator.clipboard.readText();
        setText(clipboardText);
      } else {
        // Fallback message for older browsers
        alert('Paste functionality not supported in this browser. Please paste manually.');
      }
    } catch (error) {
      console.error('Error reading from clipboard:', error);
      alert('Unable to access clipboard. Please paste manually.');
    }
  };

  const toTitleCase = (str: string) => {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };

  const clearInput = () => {
    setText('');
  };

  // Verificar si el usuario tiene permiso para usar el conversor
  if (!hasPermission(user?.permissions, 'converter')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Conversor de Texto.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 p-8 rounded-xl shadow-lg w-full max-w-4xl mx-auto"
      style={{ background: 'var(--card-bg)' }}
    >
      {/* Notificación animada de copiado */}
      {copySuccess && (
        <div
          className="fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 bg-green-500 text-white font-semibold animate-bounce"
          style={{ pointerEvents: 'none' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>¡Texto copiado automáticamente!</span>
        </div>
      )}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="form-input w-full text-xl px-6 py-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Escribe aquí..."
        style={{
          background: 'var(--input-bg)',
          borderColor: 'var(--input-border)',
          color: 'var(--foreground)',
        }}
      />
      <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
        <button
          onClick={() => {
            setText(text.toUpperCase());
            copyToClipboard(text.toUpperCase());
          }}
          className="w-full px-6 py-4 text-xl rounded-md transition-colors font-medium"
          style={{
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--button-bg)')}
        >
          To Uppercase
        </button>
        <button
          onClick={() => {
            setText(text.toLowerCase());
            copyToClipboard(text.toLowerCase());
          }}
          className="w-full px-6 py-4 text-xl rounded-md transition-colors font-medium"
          style={{
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--button-bg)')}
        >
          To Lowercase
        </button>
        <button
          onClick={() => {
            const titleCaseText = toTitleCase(text);
            setText(titleCaseText);
            copyToClipboard(titleCaseText);
          }}
          className="w-full px-6 py-4 text-xl rounded-md transition-colors font-medium"
          style={{
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--button-bg)')}
        >
          To Title Case (Aa)
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
        <button
          onClick={clearInput}
          className="w-full px-6 py-4 text-xl rounded-md transition-colors font-medium"
          style={{
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--button-bg)')}
        >
          Limpiar
        </button>
        <button
          onClick={pasteFromClipboard}
          className="w-full px-6 py-4 text-xl rounded-md transition-colors font-medium"
          style={{
            background: 'var(--button-bg)',
            color: 'var(--button-text)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--button-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--button-bg)')}
        >
          Pegar
        </button>
      </div>
    </div>
  );
}
