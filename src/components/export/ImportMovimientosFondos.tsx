"use client";
import React, { useState } from 'react';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function ImportMovimientosFondos() {
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setImporting(true);
        setProgress({ current: 0, total: 0 });
        
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            
            // Manejar tanto formato array directo como formato con metadata
            let dataArray: unknown[];
            if (Array.isArray(parsed)) {
                dataArray = parsed;
            } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
                dataArray = parsed.data;
            } else {
                throw new Error('Formato de archivo no reconocido.');
            }

            if (dataArray.length === 0) {
                alert('El archivo no contiene datos para importar.');
                setImporting(false);
                return;
            }

            if (!confirm(`¿Importar ${dataArray.length} documentos de MovimientosFondos?`)) {
                setImporting(false);
                return;
            }

            setProgress({ current: 0, total: dataArray.length });
            let imported = 0;
            let errors = 0;
            const errorMessages: string[] = [];

            for (const item of dataArray) {
                try {
                    const obj = item as Record<string, unknown>;
                    const docData = { ...obj };
                    const docId = obj.id as string | undefined;
                    delete docData.id;

                    if (docId) {
                        // Usar el ID original
                        await setDoc(doc(db, 'MovimientosFondos', docId), docData);
                    } else {
                        await addDoc(collection(db, 'MovimientosFondos'), docData);
                    }
                    imported++;
                    setProgress({ current: imported + errors, total: dataArray.length });
                } catch (itemError) {
                    errors++;
                    if (errorMessages.length < 5) {
                        errorMessages.push(itemError instanceof Error ? itemError.message : 'Error desconocido');
                    }
                    console.error('Error importing item:', item, itemError);
                }
            }

            if (errors > 0) {
                alert(`Importación completada con errores.\n\n✅ Importados: ${imported}\n❌ Errores: ${errors}\n\n${errorMessages.join('\n')}`);
            } else {
                alert(`✅ Importación exitosa! ${imported} documentos importados.`);
            }
        } catch (err) {
            console.error('Error importing:', err);
            alert(`❌ Error al importar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        } finally {
            setImporting(false);
            setProgress({ current: 0, total: 0 });
            e.target.value = '';
        }
    };

    return (
        <label className={`btn btn-sm ${importing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            {importing ? (
                <span className="flex items-center gap-1">
                    <span className="animate-spin">⏳</span>
                    {progress.total > 0 ? `${progress.current}/${progress.total}` : 'Importando...'}
                </span>
            ) : (
                'Importar MovimientosFondos'
            )}
            <input 
                type="file" 
                accept="application/json" 
                className="hidden" 
                onChange={handleFile}
                disabled={importing}
            />
        </label>
    );
}
