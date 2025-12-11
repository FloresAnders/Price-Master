"use client";
import React, { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function ExportProveedores() {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'proveedores'));
            const items = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const exportData = {
                metadata: {
                    collection: 'proveedores',
                    exportDate: new Date().toISOString(),
                    totalRecords: items.length,
                    version: '1.0'
                },
                data: items
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proveedores-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar proveedores');
        } finally {
            setExporting(false);
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? '⏳ Exportando...' : 'Exportar Proveedores'}
        </button>
    );
}
