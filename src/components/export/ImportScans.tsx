"use client";
import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function ImportScans() {
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
            let scansArray: unknown[];
            if (Array.isArray(parsed)) {
                scansArray = parsed;
            } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
                // Formato con metadata: { metadata: {...}, data: [...] }
                scansArray = parsed.data;
            } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.scans)) {
                // Otro formato posible: { scans: [...] }
                scansArray = parsed.scans;
            } else {
                throw new Error('Formato de archivo no reconocido. Se esperaba un array de scans o un objeto con propiedad "data" o "scans".');
            }

            if (scansArray.length === 0) {
                alert('El archivo no contiene scans para importar.');
                setImporting(false);
                return;
            }

            if (!confirm(`¿Importar ${scansArray.length} scans desde el archivo? Esto creará nuevos documentos en la base de datos.`)) {
                setImporting(false);
                return;
            }

            setProgress({ current: 0, total: scansArray.length });
            let imported = 0;
            let errors = 0;
            const errorMessages: string[] = [];

            for (const item of scansArray) {
                try {
                    const obj = item as Record<string, unknown>;
                    
                    // Construir el documento para importar
                    const scanDoc: Record<string, unknown> = {
                        code: String(obj.code ?? ''),
                        source: obj.source === 'mobile' ? 'mobile' : 'web',
                        processed: Boolean(obj.processed ?? false),
                    };

                    // Manejar timestamp - preservar el original si existe
                    if (obj.timestamp) {
                        if (typeof obj.timestamp === 'string') {
                            scanDoc.timestamp = new Date(obj.timestamp);
                        } else if (obj.timestamp instanceof Date) {
                            scanDoc.timestamp = obj.timestamp;
                        } else if (typeof obj.timestamp === 'object' && obj.timestamp !== null) {
                            // Firestore Timestamp object con seconds/nanoseconds
                            const ts = obj.timestamp as { seconds?: number; _seconds?: number };
                            if (ts.seconds !== undefined) {
                                scanDoc.timestamp = new Date(ts.seconds * 1000);
                            } else if (ts._seconds !== undefined) {
                                scanDoc.timestamp = new Date(ts._seconds * 1000);
                            } else {
                                scanDoc.timestamp = new Date();
                            }
                        } else {
                            scanDoc.timestamp = new Date();
                        }
                    } else {
                        scanDoc.timestamp = new Date();
                    }

                    // Campos opcionales
                    if (typeof obj.userId === 'string' && obj.userId) scanDoc.userId = obj.userId;
                    if (typeof obj.userName === 'string' && obj.userName) scanDoc.userName = obj.userName;
                    if (typeof obj.sessionId === 'string' && obj.sessionId) scanDoc.sessionId = obj.sessionId;
                    if (typeof obj.productName === 'string' && obj.productName) scanDoc.productName = obj.productName;
                    if (typeof obj.ownercompanie === 'string' && obj.ownercompanie) scanDoc.ownercompanie = obj.ownercompanie;
                    if (typeof obj.location === 'string' && obj.location && !scanDoc.ownercompanie) scanDoc.ownercompanie = obj.location;
                    if (typeof obj.hasImages === 'boolean') scanDoc.hasImages = obj.hasImages;
                    if (typeof obj.codeBU === 'string' && obj.codeBU) scanDoc.codeBU = obj.codeBU;

                    // Insertar directamente en Firestore (sin usar el servicio que sobrescribe timestamp)
                    await addDoc(collection(db, 'scans'), scanDoc);
                    imported++;
                    
                    setProgress({ current: imported + errors, total: scansArray.length });
                } catch (itemError) {
                    errors++;
                    const errorMsg = itemError instanceof Error ? itemError.message : 'Error desconocido';
                    if (errorMessages.length < 5) {
                        errorMessages.push(errorMsg);
                    }
                    console.error('Error importing scan item:', item, itemError);
                }
            }

            if (errors > 0) {
                alert(`Importación completada con errores.\n\n✅ Importados: ${imported}\n❌ Errores: ${errors}\n\nPrimeros errores:\n${errorMessages.join('\n')}`);
            } else {
                alert(`✅ Importación exitosa!\n\n${imported} scans importados correctamente.`);
            }
        } catch (err) {
            console.error('Error importing scans:', err);
            const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
            alert(`❌ Error al importar scans:\n\n${errorMsg}`);
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
                'Importar scans'
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
