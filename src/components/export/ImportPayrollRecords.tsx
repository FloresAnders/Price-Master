"use client";
import React, { useState } from 'react';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function ImportPayrollRecords() {
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

            if (!confirm(`¿Importar ${dataArray.length} registros de planilla?`)) {
                setImporting(false);
                return;
            }

            setProgress({ current: 0, total: dataArray.length });
            let imported = 0;
            let updated = 0;
            let errors = 0;
            const errorMessages: string[] = [];

            for (const item of dataArray) {
                try {
                    const obj = item as Record<string, unknown>;
                    const docData = { ...obj };
                    const docId = obj.id as string | undefined;
                    delete docData.id;

                    // Convertir timestamps si existen
                    if (docData.createdAt && typeof docData.createdAt === 'string') {
                        docData.createdAt = new Date(docData.createdAt);
                    }
                    if (docData.updatedAt && typeof docData.updatedAt === 'string') {
                        docData.updatedAt = new Date(docData.updatedAt);
                    }
                    if (docData.periodStart && typeof docData.periodStart === 'string') {
                        docData.periodStart = new Date(docData.periodStart);
                    }
                    if (docData.periodEnd && typeof docData.periodEnd === 'string') {
                        docData.periodEnd = new Date(docData.periodEnd);
                    }

                    if (docId) {
                        await setDoc(doc(db, 'payroll-records', docId), docData);
                        updated++;
                    } else {
                        await addDoc(collection(db, 'payroll-records'), docData);
                        imported++;
                    }
                    setProgress({ current: imported + updated + errors, total: dataArray.length });
                } catch (itemError) {
                    errors++;
                    if (errorMessages.length < 5) {
                        errorMessages.push(itemError instanceof Error ? itemError.message : 'Error desconocido');
                    }
                    console.error('Error importing item:', item, itemError);
                }
            }

            if (errors > 0) {
                alert(`Importación completada con errores.\n\n✅ Nuevos: ${imported}\n🔄 Actualizados: ${updated}\n❌ Errores: ${errors}\n\n${errorMessages.join('\n')}`);
            } else {
                alert(`✅ Importación exitosa!\n\n📝 Nuevos: ${imported}\n🔄 Actualizados: ${updated}`);
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
                'Importar payroll-records'
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
