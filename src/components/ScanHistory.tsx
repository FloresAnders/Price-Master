'use client';
import React from 'react';

type Props = {
  history: string[];
};

export default function ScanHistory({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="p-4 rounded-lg shadow" style={{ background: 'var(--card-bg)', color: 'var(--tab-text)' }}>
        No hay escaneos aún
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 rounded-lg shadow" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
      <h3 className="block mb-1 mx-auto text-center w-fit text-lg font-semibold mb-5">Scan History</h3>
      {history.map((code, idx) => (
        <div key={`${code}-${idx}`} className="block mb-1 mx-auto text-center w-fit text-lg font-semibold">
          {code}
        </div>
      ))}
    </div>
  );
}
