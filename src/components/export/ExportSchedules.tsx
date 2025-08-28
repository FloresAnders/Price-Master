"use client";
import React from 'react';
import { SchedulesService } from '../../services/schedules';

export default function ExportSchedules() {
    const handleExport = async () => {
        try {
            const items = await SchedulesService.getAllSchedules();
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `schedules-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar schedules');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar schedules
        </button>
    );
}
