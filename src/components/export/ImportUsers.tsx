"use client";
import React from 'react';
import { useUsers } from '../../hooks/useFirebase';
import { User } from '../../types/firestore';

export default function ImportUsers() {
    const { addUser, updateUser } = useUsers();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsedRaw = JSON.parse(text) as unknown;
            if (!Array.isArray(parsedRaw)) throw new Error('Archivo inválido: se esperaba un array');
            if (!confirm('Aplicar users desde archivo? Esto podría crear/actualizar documentos.')) return;
            for (const itemRaw of parsedRaw) {
                const item = itemRaw as Record<string, unknown>;
                if (item.id && typeof item.id === 'string') {
                    await updateUser(item.id, item as unknown as Partial<User>);
                } else {
                    // addUser expects a partial User-like object; cast safely
                    await addUser(item as unknown as Parameters<typeof addUser>[0]);
                }
            }
            alert('Users importadas');
        } catch (err) {
            console.error(err);
            alert('Error al importar users');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar users
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
