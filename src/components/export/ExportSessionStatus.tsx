"use client";
import React from 'react';
import { SessionSyncService } from '../../services/session-sync';

export default function ExportSessionStatus() {
    const handleExport = async () => {
        try {
            // export last 100 sessions (no dedicated getAll)
            const items = await SessionSyncService.getActiveSessions('');
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session_status-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar session_status');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar session_status
        </button>
    );
}
