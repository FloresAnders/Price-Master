"use client";
import React from 'react';
import { CcssConfig } from '../../types/firestore';
import { CcssConfigService } from '../../services/ccss-config';
import { useAuth } from '../../hooks/useAuth';

export default function ImportCcssConfig() {
    const { user } = useAuth();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as CcssConfig;
            // For safety, ask user before applying
            if (!confirm('Aplicar configuración CCSS desde archivo?')) return;

            // Actualizar con la nueva estructura
            const userOwnerId = user?.ownerId || user?.id || '';
            const payload: Omit<CcssConfig, 'id' | 'updatedAt'> = {
                ownerId: userOwnerId,
                companie: parsed.companie || [] // Mantener la estructura de array
            };
            await CcssConfigService.updateCcssConfig(payload);
            alert('CCSS Config importada');
        } catch (err) {
            console.error(err);
            alert('Error al importar CCSS Config');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar CCSS Config
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
