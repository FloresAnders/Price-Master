"use client";
import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function ImportSchedules() {
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
            let schedulesArray: unknown[];
            if (Array.isArray(parsed)) {
                schedulesArray = parsed;
            } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
                // Formato con metadata: { metadata: {...}, data: [...] }
                schedulesArray = parsed.data;
            } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.schedules)) {
                // Formato de exportación con filtros: { metadata: {...}, schedules: [...] }
                schedulesArray = parsed.schedules;
            } else {
                throw new Error('Formato de archivo no reconocido. Se esperaba un array de schedules o un objeto con propiedad "data" o "schedules".');
            }

            if (schedulesArray.length === 0) {
                alert('El archivo no contiene schedules para importar.');
                setImporting(false);
                return;
            }

            if (!confirm(`¿Importar ${schedulesArray.length} schedules desde el archivo? Esto creará o actualizará documentos en la base de datos.`)) {
                setImporting(false);
                return;
            }

            setProgress({ current: 0, total: schedulesArray.length });
            let imported = 0;
            let updated = 0;
            let errors = 0;
            const errorMessages: string[] = [];

            for (const item of schedulesArray) {
                try {
                    const obj = item as Record<string, unknown>;
                    
                    // Construir el documento para importar
                    const scheduleDoc: Record<string, unknown> = {};

                    // Campos requeridos
                    if (obj.companieValue !== undefined) {
                        scheduleDoc.companieValue = String(obj.companieValue);
                    } else if (obj.locationValue !== undefined) {
                        // Compatibilidad con nombre antiguo
                        scheduleDoc.companieValue = String(obj.locationValue);
                    }

                    if (obj.employeeName !== undefined) scheduleDoc.employeeName = String(obj.employeeName);
                    if (obj.year !== undefined) scheduleDoc.year = Number(obj.year);
                    if (obj.month !== undefined) scheduleDoc.month = Number(obj.month);
                    if (obj.day !== undefined) scheduleDoc.day = Number(obj.day);
                    if (obj.shift !== undefined) scheduleDoc.shift = String(obj.shift);

                    // Campos opcionales
                    if (obj.horasPorDia !== undefined) scheduleDoc.horasPorDia = Number(obj.horasPorDia);
                    if (obj.hoursPerShift !== undefined) scheduleDoc.hoursPerShift = Number(obj.hoursPerShift);
                    if (obj.notes !== undefined) scheduleDoc.notes = String(obj.notes);
                    if (obj.status !== undefined) scheduleDoc.status = String(obj.status);

                    // Manejar createdAt si existe
                    if (obj.createdAt) {
                        if (typeof obj.createdAt === 'string') {
                            scheduleDoc.createdAt = new Date(obj.createdAt);
                        } else if (obj.createdAt instanceof Date) {
                            scheduleDoc.createdAt = obj.createdAt;
                        } else if (typeof obj.createdAt === 'object' && obj.createdAt !== null) {
                            const ts = obj.createdAt as { seconds?: number; _seconds?: number };
                            if (ts.seconds !== undefined) {
                                scheduleDoc.createdAt = new Date(ts.seconds * 1000);
                            } else if (ts._seconds !== undefined) {
                                scheduleDoc.createdAt = new Date(ts._seconds * 1000);
                            }
                        }
                    }

                    // Manejar updatedAt si existe
                    if (obj.updatedAt) {
                        if (typeof obj.updatedAt === 'string') {
                            scheduleDoc.updatedAt = new Date(obj.updatedAt);
                        } else if (obj.updatedAt instanceof Date) {
                            scheduleDoc.updatedAt = obj.updatedAt;
                        } else if (typeof obj.updatedAt === 'object' && obj.updatedAt !== null) {
                            const ts = obj.updatedAt as { seconds?: number; _seconds?: number };
                            if (ts.seconds !== undefined) {
                                scheduleDoc.updatedAt = new Date(ts.seconds * 1000);
                            } else if (ts._seconds !== undefined) {
                                scheduleDoc.updatedAt = new Date(ts._seconds * 1000);
                            }
                        }
                    }

                    // Si tiene ID, intentar actualizar; si no, crear nuevo
                    if (obj.id && typeof obj.id === 'string') {
                        try {
                            const docRef = doc(db, 'schedules', obj.id);
                            await updateDoc(docRef, scheduleDoc);
                            updated++;
                        } catch {
                            // Si falla el update (documento no existe), crear nuevo
                            await addDoc(collection(db, 'schedules'), scheduleDoc);
                            imported++;
                        }
                    } else {
                        await addDoc(collection(db, 'schedules'), scheduleDoc);
                        imported++;
                    }
                    
                    setProgress({ current: imported + updated + errors, total: schedulesArray.length });
                } catch (itemError) {
                    errors++;
                    const errorMsg = itemError instanceof Error ? itemError.message : 'Error desconocido';
                    if (errorMessages.length < 5) {
                        errorMessages.push(errorMsg);
                    }
                    console.error('Error importing schedule item:', item, itemError);
                }
            }

            if (errors > 0) {
                alert(`Importación completada con errores.\n\n✅ Nuevos: ${imported}\n🔄 Actualizados: ${updated}\n❌ Errores: ${errors}\n\nPrimeros errores:\n${errorMessages.join('\n')}`);
            } else {
                alert(`✅ Importación exitosa!\n\n📝 Nuevos: ${imported}\n🔄 Actualizados: ${updated}`);
            }
        } catch (err) {
            console.error('Error importing schedules:', err);
            const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
            alert(`❌ Error al importar schedules:\n\n${errorMsg}`);
        } finally {
            setImporting(false);
            setProgress({ current: 0, total: 0 });
            // Limpiar el input para permitir reimportar el mismo archivo
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
                'Importar schedules'
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
