'use client';
import React, { useState } from 'react';

export default function TextConversion() {
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg shadow" style={{ background: 'var(--card-bg)' }}>
      <label className="font-medium" style={{ color: 'var(--foreground)' }}>
        Text to Convert
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="form-input w-full rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Escribe aquí..."
        style={{
          background: 'var(--input-bg)',
          borderColor: 'var(--input-border)',
          color: 'var(--foreground)',
        }}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setText(text.toUpperCase())}
          className="px-4 py-2 rounded transition-colors"
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
          className="px-4 py-2 rounded transition-colors"
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
