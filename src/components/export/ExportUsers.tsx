"use client";
import React from 'react';
import { UsersService } from '../../services/users';

export default function ExportUsers() {
    const handleExport = async () => {
        try {
            const items = await UsersService.getAllUsers();
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `users-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar users');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar users
        </button>
    );
}
