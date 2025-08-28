"use client";
import React from 'react';

export default function ImportSessionStatus() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            console.log('Parsed session_status', parsed);
            alert('session_status file parsed (no write performed)');
        } catch (err) {
            console.error(err);
            alert('Error al importar session_status');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar session_status
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
