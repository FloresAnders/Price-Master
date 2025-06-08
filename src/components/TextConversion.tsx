'use client';
import React, { useState } from 'react';

export default function TextConversion() {
  const [text, setText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = (value: string) => {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(value);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

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
      </div>
    </div>
  );
}
