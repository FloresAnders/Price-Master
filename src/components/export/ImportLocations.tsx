"use client";
import React from 'react';
import { LocationsService } from '../../services/locations';

export default function ImportLocations() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar locations desde archivo? Esto podría crear/actualizar documentos.')) return;
            // naive apply: create each location if no id, otherwise update
            for (const item of parsed) {
                if (item.id) {
                    await LocationsService.updateLocation(item.id, item);
                } else {
                    await LocationsService.addLocation(item);
                }
            }
            alert('Locations importadas');
        } catch (err) {
            console.error(err);
            alert('Error al importar locations');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar locations
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
