"use client";
import React from 'react';
import { useUsers } from '../../hooks/useFirebase';

export default function ImportUsers() {
    const { addUser, updateUser } = useUsers();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar users desde archivo? Esto podría crear/actualizar documentos.')) return;
            for (const item of parsed) {
                if (item.id) {
                    await updateUser(item.id, item);
                } else {
                    await addUser(item as any);
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
