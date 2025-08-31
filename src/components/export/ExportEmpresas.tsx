"use client";
import React from 'react';
import { EmpresasService } from '../../services/empresas';

export default function ExportEmpresas() {
    const handleExport = async () => {
        try {
            const items = await EmpresasService.getAllEmpresas();
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `empresas-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar empresas');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar empresas
        </button>
    );
}
