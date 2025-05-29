'use client';
import React from 'react';

type Props = {
  history: string[];
};

export default function ScanHistory({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow text-gray-500">
        No hay escaneos aún
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold">Scan History</h3>
      {history.map((code, idx) => (
        <div key={`${code}-${idx}`} className="text-sm text-gray-800">
          {code}
        </div>
      ))}
    </div>
  );
}
