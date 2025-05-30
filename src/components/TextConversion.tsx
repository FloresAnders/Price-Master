'use client';
import React, { useState } from 'react';

export default function TextConversion() {
  const [text, setText] = useState('');

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 p-8 rounded-xl shadow-lg w-full max-w-4xl mx-auto"
      style={{ background: 'var(--card-bg)' }}
    >
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
          onClick={() => setText(text.toUpperCase())}
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
          onClick={() => setText(text.toLowerCase())}
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
