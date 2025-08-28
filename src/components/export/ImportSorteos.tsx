"use client";
import React from 'react';
import { SorteosService } from '../../services/sorteos';

export default function ImportSorteos() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar sorteos desde archivo? Esto podría crear/actualizar documentos.')) return;
            for (const item of parsed) {
                if (item.id) {
                    await SorteosService.updateSorteo(item.id, item);
                } else {
                    await SorteosService.addSorteo(item);
                }
            }
            alert('Sorteos importadas');
        } catch (err) {
            console.error(err);
            alert('Error al importar sorteos');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar sorteos
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
