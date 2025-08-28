"use client";
import React from 'react';
import { SorteosService } from '../../services/sorteos';

export default function ExportSorteos() {
    const handleExport = async () => {
        try {
            const items = await SorteosService.getAllSorteos();
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sorteos-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar sorteos');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar sorteos
        </button>
    );
}
