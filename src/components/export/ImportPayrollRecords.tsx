"use client";
import React from 'react';

export default function ImportPayrollRecords() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar payroll-records desde archivo? Esto podría crear/actualizar documentos. (IMPORT PARCIAL)')) return;
            // Payroll records mapping is domain-specific. Rather than guessing, show a warning and skip.
            console.warn('Payroll records import invoked but mapping is not implemented. Parsed items:', parsed?.length ?? 0);
            alert('Payroll records detectadas en el archivo, pero la importación automática no está implementada para evitar errores.');
        } catch (err) {
            console.error(err);
            alert('Error al importar payroll-records');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar payroll-records
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
