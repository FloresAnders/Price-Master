"use client";
import React from 'react';
import { LocationsService } from '../../services/locations';

export default function ExportLocations() {
    const handleExport = async () => {
        try {
            const items = await LocationsService.getAllLocations();
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `locations-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar locations');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar locations
        </button>
    );
}
