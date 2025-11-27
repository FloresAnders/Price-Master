"use client";
import React from 'react';
import { CcssConfigService } from '../../services/ccss-config';
import { useAuth } from '../../hooks/useAuth';

export default function ExportCcssConfig() {
    const { user } = useAuth();

    const handleExport = async () => {
        try {
            const userOwnerId = user?.ownerId || user?.id || '';
            const config = await CcssConfigService.getCcssConfig(userOwnerId);
            const data = JSON.stringify(config, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ccss-config-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar CCSS Config');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar CCSS Config
        </button>
    );
}
