"use client";
import React from 'react';
import { SchedulesService } from '../../services/schedules';

export default function ImportSchedules() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar schedules desde archivo? Esto podría crear/actualizar documentos.')) return;
            for (const item of parsed) {
                // Ensure imported object uses the new field name
                const payload = {
                    ...item,
                    ...(item.locationValue && { companieValue: item.locationValue })
                };

                if (item.id) {
                    await SchedulesService.updateSchedule(item.id, payload);
                } else {
                    await SchedulesService.addSchedule(payload);
                }
            }
            alert('Schedules importadas');
        } catch (err) {
            console.error(err);
            alert('Error al importar schedules');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar schedules
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
