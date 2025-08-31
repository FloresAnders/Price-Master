"use client";
import React from 'react';
import { EmpresasService } from '../../services/empresas';

export default function ImportEmpresas() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar empresas desde archivo? Esto podría crear/actualizar documentos.')) return;
            // naive apply: create each empresa if no id, otherwise update
            for (const item of parsed) {
                if (item.id) {
                    await EmpresasService.updateEmpresa(item.id, item);
                } else {
                    await EmpresasService.addEmpresa(item);
                }
            }
            alert('Empresas importadas');
        } catch (err) {
            console.error(err);
            alert('Error al importar empresas');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar empresas
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
