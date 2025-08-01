    'use client';

import React, { useState, useRef } from 'react';
import { TestTube, Beaker, FlaskConical, Zap, Code, Database, Upload, Image, CheckCircle, AlertCircle, Calendar, FileText } from 'lucide-react';
import { storage } from '@/config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function Pruebas() {
    const [activeTest, setActiveTest] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<{ [key: string]: string }>({});
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleRunTest = (testId: string, testName: string) => {
        setActiveTest(testId);
        
        // Simular una prueba
        setTimeout(() => {
            const results = [
                '✅ Test ejecutado correctamente',
                '⚠️ Test completado con advertencias',
                '❌ Test falló - revisar configuración',
                '🔄 Test en progreso...',
                '📊 Datos de prueba generados'
            ];
            
            const randomResult = results[Math.floor(Math.random() * results.length)];
            setTestResults(prev => ({
                ...prev,
                [testId]: `${testName}: ${randomResult}`
            }));
            setActiveTest(null);
        }, 2000);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validar tipo de archivo
            if (!file.type.startsWith('image/')) {
                setTestResults(prev => ({
                    ...prev,
                    'file-validation': `❌ Error: El archivo debe ser una imagen (${file.type} no es válido)`
                }));
                return;
            }

            // Validar tamaño (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setTestResults(prev => ({
                    ...prev,
                    'file-validation': `❌ Error: El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo 5MB.`
                }));
                return;
            }

            setSelectedFile(file);
            setTestResults(prev => ({
                ...prev,
                'file-validation': `✅ Archivo seleccionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`
            }));
        }
    };

    const uploadImageToFirebase = async () => {
        if (!selectedFile) {
            setTestResults(prev => ({
                ...prev,
                'upload-error': '❌ Error: No hay archivo seleccionado'
            }));
            return;
        }

        setUploadStatus('uploading');
        setUploadProgress(0);

        try {
            // Verificar configuración antes de subir
            setTestResults(prev => ({
                ...prev,
                'pre-upload-check': `🔍 Verificando configuración de Firebase...`,
                'storage-bucket': `📦 Bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'NO CONFIGURADO'}`,
                'firebase-project': `🔧 Proyecto: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NO CONFIGURADO'}`
            }));

            if (!storage) {
                throw new Error('Firebase Storage no está inicializado. Verifica las variables de entorno.');
            }

            // Crear referencia en Firebase Storage (usando /exports/ que tiene permisos)
            const timestamp = Date.now();
            const fileName = `${timestamp}-${selectedFile.name}`;
            const storageRef = ref(storage, `exports/images/${fileName}`);

            setTestResults(prev => ({
                ...prev,
                'pre-upload-check': `✅ Configuración verificada`,
                'upload-path': `📁 Ruta de subida: exports/images/${fileName}`,
                'file-info': `📄 Archivo: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`
            }));

            // Crear tarea de subida con seguimiento de progreso
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);

            // Monitorear el progreso de subida
            uploadTask.on('state_changed', 
                (snapshot) => {
                    // Calcular progreso
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                    
                    // Log del progreso
                    setTestResults(prev => ({
                        ...prev,
                        'upload-progress': `🔄 Subiendo... ${Math.round(progress)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes} bytes)`
                    }));
                },
                (error) => {
                    // Manejar errores específicos de Firebase
                    setUploadStatus('error');
                    let errorMessage = 'Error desconocido';
                    
                    switch (error.code) {
                        case 'storage/unauthorized':
                            errorMessage = 'Sin permisos para subir archivos. Verifica la configuración de Firebase Storage.';
                            break;
                        case 'storage/canceled':
                            errorMessage = 'Subida cancelada por el usuario.';
                            break;
                        case 'storage/unknown':
                            errorMessage = 'Error desconocido. Verifica la conexión a internet.';
                            break;
                        case 'storage/object-not-found':
                            errorMessage = 'Archivo no encontrado.';
                            break;
                        case 'storage/bucket-not-found':
                            errorMessage = 'Bucket de Storage no encontrado. Verifica la configuración.';
                            break;
                        case 'storage/project-not-found':
                            errorMessage = 'Proyecto Firebase no encontrado.';
                            break;
                        case 'storage/quota-exceeded':
                            errorMessage = 'Cuota de almacenamiento excedida.';
                            break;
                        case 'storage/unauthenticated':
                            errorMessage = 'Usuario no autenticado.';
                            break;
                        case 'storage/retry-limit-exceeded':
                            errorMessage = 'Límite de reintentos excedido.';
                            break;
                        case 'storage/invalid-checksum':
                            errorMessage = 'Checksum del archivo inválido.';
                            break;
                        default:
                            errorMessage = `Error de Firebase: ${error.message}`;
                    }
                    
                    setTestResults(prev => ({
                        ...prev,
                        'firebase-upload': `❌ Error al subir imagen: ${errorMessage}`,
                        'error-code': `🚨 Código de error: ${error.code}`,
                        'error-details': `📝 Detalles: ${error.message}`
                    }));
                },
                async () => {
                    // Subida completada exitosamente
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        
                        setUploadedImageUrl(downloadURL);
                        setUploadStatus('success');
                        setTestResults(prev => ({
                            ...prev,
                            'firebase-upload': `✅ Imagen subida exitosamente a Firebase Storage`,
                            'firebase-url': `📎 URL: ${downloadURL}`,
                            'upload-details': `📊 Archivo: ${selectedFile.name} | Tamaño: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB | Tiempo: ${new Date().toLocaleTimeString()}`,
                            'firebase-path': `📁 Ruta: exports/images/${fileName}`,
                            'firebase-metadata': `🔍 Metadata: ${uploadTask.snapshot.metadata.contentType} | ${uploadTask.snapshot.totalBytes} bytes`
                        }));

                        // Limpiar archivo seleccionado
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    } catch (urlError) {
                        setUploadStatus('error');
                        setTestResults(prev => ({
                            ...prev,
                            'firebase-upload': `❌ Error al obtener URL de descarga: ${urlError instanceof Error ? urlError.message : 'Error desconocido'}`
                        }));
                    }
                }
            );

        } catch (error) {
            setUploadStatus('error');
            setTestResults(prev => ({
                ...prev,
                'firebase-upload': `❌ Error al inicializar subida: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }));
        }
    };

    const testFirebaseConnection = async () => {
        setActiveTest('firebase-connection-test');
        
        try {
            // Test 1: Verificar variables de entorno
            const envVars = {
                apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
            };

            const missingVars = Object.entries(envVars).filter(([, value]) => !value);
            
            setTestResults(prev => ({
                ...prev,
                'firebase-env': missingVars.length === 0 
                    ? `✅ Todas las variables de entorno están configuradas`
                    : `❌ Variables faltantes: ${missingVars.map(([key]) => key).join(', ')}`,
                'firebase-config': `🔧 Storage Bucket: ${envVars.storageBucket || 'NO CONFIGURADO'}`,
                'firebase-project': `🔧 Project ID: ${envVars.projectId || 'NO CONFIGURADO'}`
            }));

            if (!storage) {
                throw new Error('Firebase Storage no está inicializado');
            }

            // Test 2: Crear una referencia de prueba
            const testRef = ref(storage, 'test-connection/ping.txt');
            setTestResults(prev => ({
                ...prev,
                'firebase-config': `✅ Firebase Storage inicializado correctamente`,
                'firebase-reference': `🔗 Referencia de prueba creada: ${testRef.fullPath}`
            }));

            // Test 3: Verificar permisos (crear un pequeño archivo de prueba)
            const testData = new Blob(['Firebase connection test'], { type: 'text/plain' });
            const uploadTask = uploadBytesResumable(testRef, testData);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setTestResults(prev => ({
                        ...prev,
                        'firebase-permissions': `🔄 Probando permisos... ${Math.round(progress)}%`
                    }));
                },
                (error) => {
                    setTestResults(prev => ({
                        ...prev,
                        'firebase-permissions': `❌ Error de permisos: ${error.code} - ${error.message}`,
                        'firebase-solution': `💡 Solución: Verifica las reglas de Firebase Storage y los permisos del bucket`
                    }));
                    setActiveTest(null);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setTestResults(prev => ({
                            ...prev,
                            'firebase-permissions': `✅ Permisos verificados correctamente`,
                            'firebase-test-url': `📎 URL de prueba: ${downloadURL}`,
                            'firebase-status': `🎉 Firebase Storage está funcionando correctamente`
                        }));
                    } catch (urlError) {
                        setTestResults(prev => ({
                            ...prev,
                            'firebase-permissions': `⚠️ Subida exitosa pero error al obtener URL: ${urlError}`
                        }));
                    }
                    setActiveTest(null);
                }
            );

        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                'firebase-connection': `❌ Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                'firebase-troubleshoot': `🔧 Verifica: 1) Variables de entorno, 2) Configuración de Firebase, 3) Permisos del bucket`
            }));
            setActiveTest(null);
        }
    };

    const testExportsFolder = async () => {
        setActiveTest('test-exports-folder');
        
        try {
            setTestResults(prev => ({
                ...prev,
                'exports-test': `🔧 Probando carpeta /exports/ (acceso garantizado)...`
            }));

            // Crear referencia en la carpeta exports que ya tiene permisos
            const timestamp = Date.now();
            const testRef = ref(storage, `exports/test-${timestamp}.txt`);
            
            // Crear datos de prueba
            const testData = new Blob([`Test de exports folder - ${new Date().toISOString()}`], { type: 'text/plain' });
            const uploadTask = uploadBytesResumable(testRef, testData);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setTestResults(prev => ({
                        ...prev,
                        'exports-progress': `🔄 Subiendo a /exports/... ${Math.round(progress)}%`
                    }));
                },
                (error) => {
                    setTestResults(prev => ({
                        ...prev,
                        'exports-test': `❌ Error inesperado en /exports/: ${error.code} - ${error.message}`,
                        'exports-note': `🤔 Esto es extraño, /exports/ debería funcionar según tus reglas`
                    }));
                    setActiveTest(null);
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setTestResults(prev => ({
                            ...prev,
                            'exports-test': `✅ Carpeta /exports/ funciona correctamente`,
                            'exports-url': `📎 URL de prueba: ${downloadURL}`,
                            'exports-suggestion': `💡 Considera usar /exports/ para tus imágenes o agregar regla para /test-images/`
                        }));
                    } catch (urlError) {
                        setTestResults(prev => ({
                            ...prev,
                            'exports-test': `⚠️ Subida exitosa pero error al obtener URL: ${urlError}`
                        }));
                    }
                    setActiveTest(null);
                }
            );

        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                'exports-test': `❌ Error al probar /exports/: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }));
            setActiveTest(null);
        }
    };

    // Función para exportar horarios/schedules con filtros
    const exportSchedulesWithFilters = async () => {
        setActiveTest('export-schedules-filters');
        
        try {
            setTestResults(prev => ({
                ...prev,
                'export-init': '🔄 Iniciando exportación de horarios con filtros...',
                'export-status': '📊 Obteniendo datos de schedules desde Firebase...'
            }));

            // Importar servicios necesarios
            const { SchedulesService } = await import('@/services/schedules');
            const { LocationsService } = await import('@/services/locations');
            
            // Obtener todos los schedules y locations
            const allSchedules = await SchedulesService.getAllSchedules();
            const allLocations = await LocationsService.getAllLocations();
            
            setTestResults(prev => ({
                ...prev,
                'export-data': `✅ Datos obtenidos: ${allSchedules.length} registros de horarios`,
                'export-locations': `📍 Ubicaciones disponibles: ${allLocations.map(l => l.label).join(', ')}`
            }));

            // Crear filtros interactivos
            const exportModal = document.createElement('div');
            exportModal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
                align-items: center; justify-content: center;
            `;
            
            exportModal.innerHTML = `
                <div style="background: white; padding: 24px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: bold;">
                        📥 Exportar Horarios con Filtros
                    </h3>
                    
                    <!-- Filtro de Fechas -->
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                            📅 Rango de Fechas:
                        </label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #6b7280;">Desde:</label>
                                <input type="date" id="dateFrom" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 14px; color: #6b7280;">Hasta:</label>
                                <input type="date" id="dateTo" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Filtro de Ubicaciones -->
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                            📍 Ubicaciones:
                        </label>
                        <div id="locationFilters" style="max-height: 200px; overflow-y: auto; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px;">
                            ${allLocations.map(location => `
                                <label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;">
                                    <input type="checkbox" value="${location.value}" checked style="margin-right: 8px;">
                                    <span style="color: #374151;">${location.label} (${location.value})</span>
                                </label>
                            `).join('')}
                        </div>
                        <div style="margin-top: 8px; display: flex; gap: 8px;">
                            <button id="selectAllLocations" style="padding: 4px 8px; font-size: 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Todas
                            </button>
                            <button id="clearAllLocations" style="padding: 4px 8px; font-size: 12px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Ninguna
                            </button>
                        </div>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="cancelExport" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            Cancelar
                        </button>
                        <button id="executeExport" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                            📥 Exportar Horarios
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(exportModal);
            
            // Configurar fecha por defecto (último mes)
            const today = new Date();
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            
            (document.getElementById('dateFrom') as HTMLInputElement).valueAsDate = lastMonth;
            (document.getElementById('dateTo') as HTMLInputElement).valueAsDate = endOfLastMonth;
            
            // Event listeners
            document.getElementById('selectAllLocations')?.addEventListener('click', () => {
                document.querySelectorAll('#locationFilters input[type="checkbox"]').forEach((cb: any) => cb.checked = true);
            });
            
            document.getElementById('clearAllLocations')?.addEventListener('click', () => {
                document.querySelectorAll('#locationFilters input[type="checkbox"]').forEach((cb: any) => cb.checked = false);
            });
            
            document.getElementById('cancelExport')?.addEventListener('click', () => {
                document.body.removeChild(exportModal);
                setActiveTest(null);
            });
            
            document.getElementById('executeExport')?.addEventListener('click', async () => {
                const dateFrom = (document.getElementById('dateFrom') as HTMLInputElement).value;
                const dateTo = (document.getElementById('dateTo') as HTMLInputElement).value;
                const selectedLocations = Array.from(document.querySelectorAll('#locationFilters input[type="checkbox"]:checked'))
                    .map((cb: any) => cb.value);
                
                if (!dateFrom || !dateTo) {
                    alert('Por favor selecciona ambas fechas');
                    return;
                }
                
                if (selectedLocations.length === 0) {
                    alert('Por favor selecciona al menos una ubicación');
                    return;
                }
                
                // Filtrar datos
                const fromDate = new Date(dateFrom);
                const toDate = new Date(dateTo);
                
                const filteredSchedules = allSchedules.filter(schedule => {
                    const scheduleDate = new Date(schedule.year, schedule.month - 1, schedule.day);
                    return scheduleDate >= fromDate && 
                           scheduleDate <= toDate && 
                           selectedLocations.includes(schedule.locationValue);
                });
                
                setTestResults(prev => ({
                    ...prev,
                    'export-filtering': `🔍 Filtros aplicados: ${filteredSchedules.length} registros de ${allSchedules.length} totales`,
                    'export-date-range': `📅 Rango: ${dateFrom} hasta ${dateTo}`,
                    'export-locations-selected': `📍 Ubicaciones: ${selectedLocations.join(', ')}`
                }));
                
                // Crear estructura de exportación
                const exportData = {
                    metadata: {
                        exportDate: new Date().toISOString(),
                        version: '1.0',
                        filters: {
                            dateFrom,
                            dateTo,
                            locations: selectedLocations
                        },
                        totalRecords: filteredSchedules.length,
                        originalTotalRecords: allSchedules.length
                    },
                    schedules: filteredSchedules.map(schedule => ({
                        ...schedule,
                        exportedAt: new Date().toISOString()
                    })),
                    locations: allLocations.filter(loc => selectedLocations.includes(loc.value))
                };
                
                // Generar archivo
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `schedules_export_${dateFrom}_to_${dateTo}_${selectedLocations.length}loc.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                setTestResults(prev => ({
                    ...prev,
                    'export-complete': `✅ Exportación completada exitosamente`,
                    'export-filename': `📁 Archivo: schedules_export_${dateFrom}_to_${dateTo}_${selectedLocations.length}loc.json`,
                    'export-records': `📊 ${filteredSchedules.length} registros exportados`
                }));
                
                document.body.removeChild(exportModal);
                setActiveTest(null);
            });
            
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                'export-error': `❌ Error durante exportación: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }));
            setActiveTest(null);
        }
    };

    // Función para importar horarios/schedules
    const importSchedulesFromFile = async () => {
        setActiveTest('import-schedules');
        
        try {
            setTestResults(prev => ({
                ...prev,
                'import-init': '🔄 Iniciando importación de horarios...',
                'import-status': '📂 Selecciona un archivo JSON para importar'
            }));

            // Crear input de archivo
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';
            
            fileInput.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                
                try {
                    setTestResults(prev => ({
                        ...prev,
                        'import-file': `📄 Archivo seleccionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
                        'import-reading': '🔍 Leyendo contenido del archivo...'
                    }));
                    
                    const text = await file.text();
                    const importData = JSON.parse(text);
                    
                    // Validar estructura
                    if (!importData.schedules || !Array.isArray(importData.schedules)) {
                        throw new Error('Archivo inválido: falta el array "schedules"');
                    }
                    
                    setTestResults(prev => ({
                        ...prev,
                        'import-validation': `✅ Archivo válido: ${importData.schedules.length} registros encontrados`,
                        'import-metadata': importData.metadata ? 
                            `📋 Metadata: Exportado el ${new Date(importData.metadata.exportDate).toLocaleString()}` :
                            '⚠️ Sin metadata (archivo antiguo o externo)'
                    }));
                    
                    // Crear modal de confirmación
                    const confirmModal = document.createElement('div');
                    confirmModal.style.cssText = `
                        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                        background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
                        align-items: center; justify-content: center;
                    `;
                    
                    const duplicateCheck = importData.schedules.length > 0 ? 
                        await checkForDuplicates(importData.schedules) : { duplicates: 0, news: 0 };
                    
                    confirmModal.innerHTML = `
                        <div style="background: white; padding: 24px; border-radius: 12px; max-width: 500px; width: 90%;">
                            <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: bold;">
                                📥 Confirmar Importación
                            </h3>
                            
                            <div style="margin-bottom: 20px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
                                <h4 style="margin: 0 0 12px 0; color: #374151;">Resumen:</h4>
                                <p style="margin: 4px 0; color: #6b7280;">📊 Total registros: ${importData.schedules.length}</p>
                                <p style="margin: 4px 0; color: #10b981;">🆕 Registros nuevos: ${duplicateCheck.news}</p>
                                <p style="margin: 4px 0; color: #f59e0b;">🔄 Posibles duplicados: ${duplicateCheck.duplicates}</p>
                                ${importData.metadata ? `
                                    <p style="margin: 4px 0; color: #6b7280;">📅 Rango: ${importData.metadata.filters?.dateFrom} - ${importData.metadata.filters?.dateTo}</p>
                                    <p style="margin: 4px 0; color: #6b7280;">📍 Ubicaciones: ${importData.metadata.filters?.locations?.join(', ') || 'No especificadas'}</p>
                                ` : ''}
                            </div>
                            
                            <div style="background: #fef3c7; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                                <p style="margin: 0; color: #92400e; font-size: 14px;">
                                    ⚠️ Esta acción agregará los registros a la base de datos. Los duplicados podrían sobrescribir datos existentes.
                                </p>
                            </div>
                            
                            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                <button id="cancelImport" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                                    Cancelar
                                </button>
                                <button id="executeImport" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                                    📥 Confirmar Importación
                                </button>
                            </div>
                        </div>
                    `;
                    
                    document.body.appendChild(confirmModal);
                    
                    document.getElementById('cancelImport')?.addEventListener('click', () => {
                        document.body.removeChild(confirmModal);
                        setActiveTest(null);
                    });
                    
                    document.getElementById('executeImport')?.addEventListener('click', async () => {
                        document.body.removeChild(confirmModal);
                        await performImport(importData.schedules);
                    });
                    
                } catch (error) {
                    setTestResults(prev => ({
                        ...prev,
                        'import-error': `❌ Error al procesar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`
                    }));
                    setActiveTest(null);
                }
            };
            
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
            
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                'import-error': `❌ Error durante importación: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }));
            setActiveTest(null);
        }
    };

    // Función auxiliar para verificar duplicados
    const checkForDuplicates = async (schedulesToImport: any[]) => {
        try {
            const { SchedulesService } = await import('@/services/schedules');
            const existingSchedules = await SchedulesService.getAllSchedules();
            
            let duplicates = 0;
            let news = 0;
            
            schedulesToImport.forEach(newSchedule => {
                const isDuplicate = existingSchedules.some(existing => 
                    existing.locationValue === newSchedule.locationValue &&
                    existing.employeeName === newSchedule.employeeName &&
                    existing.year === newSchedule.year &&
                    existing.month === newSchedule.month &&
                    existing.day === newSchedule.day
                );
                
                if (isDuplicate) {
                    duplicates++;
                } else {
                    news++;
                }
            });
            
            return { duplicates, news };
        } catch (error) {
            return { duplicates: 0, news: schedulesToImport.length };
        }
    };

    // Función auxiliar para realizar la importación
    const performImport = async (schedules: any[]) => {
        try {
            const { SchedulesService } = await import('@/services/schedules');
            
            setTestResults(prev => ({
                ...prev,
                'import-executing': `🔄 Importando ${schedules.length} registros...`,
                'import-progress': '📊 Progreso: 0%'
            }));
            
            let imported = 0;
            let errors = 0;
            
            for (const schedule of schedules) {
                try {
                    // Limpiar datos innecesarios de exportación
                    const cleanSchedule = {
                        locationValue: schedule.locationValue,
                        employeeName: schedule.employeeName,
                        year: schedule.year,
                        month: schedule.month,
                        day: schedule.day,
                        shift: schedule.shift,
                        ...(schedule.horasPorDia && { horasPorDia: schedule.horasPorDia })
                    };
                    
                    await SchedulesService.addSchedule(cleanSchedule);
                    imported++;
                    
                    // Actualizar progreso cada 10 registros
                    if (imported % 10 === 0 || imported === schedules.length) {
                        const progress = Math.round((imported / schedules.length) * 100);
                        setTestResults(prev => ({
                            ...prev,
                            'import-progress': `📊 Progreso: ${progress}% (${imported}/${schedules.length})`
                        }));
                    }
                    
                } catch (error) {
                    errors++;
                    console.error(`Error importing schedule:`, schedule, error);
                }
            }
            
            setTestResults(prev => ({
                ...prev,
                'import-complete': `✅ Importación completada`,
                'import-success': `📊 Registros importados: ${imported}`,
                'import-errors': errors > 0 ? `❌ Errores: ${errors}` : '✅ Sin errores',
                'import-summary': `🎉 Proceso finalizado: ${imported} exitosos de ${schedules.length} totales`
            }));
            
            setActiveTest(null);
            
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                'import-error': `❌ Error durante importación: ${error instanceof Error ? error.message : 'Error desconocido'}`
            }));
            setActiveTest(null);
        }
    };

    const testSections = [
        {
            id: 'api-tests',
            title: 'Pruebas de API',
            icon: <Database className="w-6 h-6" />,
            color: 'blue',
            description: 'Testear endpoints y conexiones de base de datos',
            tests: [
                { id: 'api-connection', name: 'Conexión API' },
                { id: 'api-auth', name: 'Autenticación' },
                { id: 'api-data', name: 'Integridad de datos' }
            ]
        },
        {
            id: 'ui-tests',
            title: 'Pruebas de UI',
            icon: <Code className="w-6 h-6" />,
            color: 'green',
            description: 'Validar componentes y interfaz de usuario',
            tests: [
                { id: 'ui-components', name: 'Componentes React' },
                { id: 'ui-responsive', name: 'Diseño responsivo' },
                { id: 'ui-accessibility', name: 'Accesibilidad' }
            ]
        },
        {
            id: 'performance-tests',
            title: 'Pruebas de Rendimiento',
            icon: <Zap className="w-6 h-6" />,
            color: 'yellow',
            description: 'Evaluar velocidad y eficiencia del sistema',
            tests: [
                { id: 'perf-load', name: 'Tiempo de carga' },
                { id: 'perf-memory', name: 'Uso de memoria' },
                { id: 'perf-network', name: 'Peticiones de red' }
            ]
        },
        {
            id: 'firebase-tests',
            title: 'Pruebas de Firebase',
            icon: <Upload className="w-6 h-6" />,
            color: 'purple',
            description: 'Testing de Firebase Storage y subida de archivos',
            tests: [
                { id: 'firebase-connection', name: 'Conexión Firebase', action: testFirebaseConnection },
                { id: 'test-exports', name: 'Probar /exports/', action: testExportsFolder },
                { id: 'firebase-auth-test', name: 'Autenticación Firebase' },
                { id: 'firebase-storage', name: 'Firebase Storage' }
            ]
        },
        {
            id: 'schedule-tests',
            title: 'Gestión de Horarios',
            icon: <Database className="w-6 h-6" />,
            color: 'indigo',
            description: 'Exportar e importar schedules con filtros avanzados',
            tests: [
                { id: 'export-schedules-filters', name: 'Exportar con Filtros', action: exportSchedulesWithFilters },
                { id: 'import-schedules', name: 'Importar Horarios', action: importSchedulesFromFile },
                { id: 'validate-schedules', name: 'Validar Integridad' },
                { id: 'backup-schedules', name: 'Backup Completo' }
            ]
        }
    ];

    const getColorClasses = (color: string) => {
        const colorMap = {
            blue: {
                bg: 'bg-blue-100 dark:bg-blue-900/30',
                hover: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
                text: 'text-blue-600',
                border: 'border-blue-400'
            },
            green: {
                bg: 'bg-green-100 dark:bg-green-900/30',
                hover: 'hover:bg-green-200 dark:hover:bg-green-900/50',
                text: 'text-green-600',
                border: 'border-green-400'
            },
            yellow: {
                bg: 'bg-yellow-100 dark:bg-yellow-900/30',
                hover: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
                text: 'text-yellow-600',
                border: 'border-yellow-400'
            },
            purple: {
                bg: 'bg-purple-100 dark:bg-purple-900/30',
                hover: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
                text: 'text-purple-600',
                border: 'border-purple-400'
            },
            indigo: {
                bg: 'bg-indigo-100 dark:bg-indigo-900/30',
                hover: 'hover:bg-indigo-200 dark:hover:bg-indigo-900/50',
                text: 'text-indigo-600',
                border: 'border-indigo-400'
            }
        };
        return colorMap[color as keyof typeof colorMap] || colorMap.blue;
    };

    return (
        <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <TestTube className="w-10 h-10 text-orange-600" />
                </div>
                <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Área de Pruebas</h1>
                <p className="text-[var(--muted-foreground)] max-w-2xl mx-auto">
                    Sistema de testing y validación de funcionalidades. Ejecuta pruebas para verificar el correcto funcionamiento de los diferentes módulos de la aplicación.
                </p>
            </div>

            {/* Test Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
                {testSections.map((section) => {
                    const colors = getColorClasses(section.color);
                    return (
                        <div key={section.id} className="bg-[var(--input-bg)] rounded-lg border border-[var(--border)] p-6">
                            <div className="flex items-center mb-4">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.bg} mr-4`}>
                                    <span className={colors.text}>{section.icon}</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-[var(--foreground)]">{section.title}</h3>
                                    <p className="text-sm text-[var(--muted-foreground)]">{section.description}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {section.tests.map((test) => (
                                    <button
                                        key={test.id}
                                        onClick={() => {
                                            if (test.action && typeof test.action === 'function') {
                                                test.action();
                                            } else {
                                                handleRunTest(test.id, test.name);
                                            }
                                        }}
                                        disabled={activeTest === test.id}
                                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                                            activeTest === test.id
                                                ? `${colors.bg} ${colors.border} cursor-not-allowed`
                                                : `bg-[var(--background)] border-[var(--border)] hover:${colors.hover} hover:${colors.border}`
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-[var(--foreground)]">
                                                {test.name}
                                            </span>
                                            {activeTest === test.id && (
                                                <div className="flex items-center">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
                                                    <span className="text-xs text-[var(--muted-foreground)]">Ejecutando...</span>
                                                </div>
                                            )}
                                        </div>
                                        {testResults[test.id] && (
                                            <div className="mt-2 text-xs text-[var(--muted-foreground)] bg-[var(--card-bg)] p-2 rounded">
                                                {testResults[test.id]}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Firebase Image Upload Section */}
            <div className="bg-[var(--input-bg)] rounded-lg border border-[var(--border)] p-6 mb-8">
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="w-5 h-5 mr-2 text-purple-600" />
                    Subir Imagen a Firebase Storage (/exports/images/)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* File Selection */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Seleccionar Imagen
                        </label>
                        <div className="relative">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="image-upload"
                            />
                            <label
                                htmlFor="image-upload"
                                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:border-purple-400 transition-colors duration-200 bg-[var(--background)]"
                            >
                                <div className="text-center">
                                    <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--muted-foreground)]" />
                                    <p className="text-sm text-[var(--muted-foreground)]">
                                        {selectedFile ? selectedFile.name : 'Click para seleccionar imagen'}
                                    </p>
                                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                        JPG, PNG, GIF (máx. 5MB)
                                    </p>
                                </div>
                            </label>
                        </div>
                        
                        {selectedFile && (
                            <div className="mt-3 p-3 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-[var(--foreground)]">{selectedFile.name}</p>
                                        <p className="text-xs text-[var(--muted-foreground)]">
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
                                        </p>
                                    </div>
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Upload Controls */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Controles de Subida
                        </label>
                        
                        <div className="space-y-3">
                            <button
                                onClick={uploadImageToFirebase}
                                disabled={!selectedFile || uploadStatus === 'uploading'}
                                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center ${
                                    !selectedFile || uploadStatus === 'uploading'
                                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`}
                            >
                                {uploadStatus === 'uploading' ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Subiendo... {Math.round(uploadProgress)}%
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Subir a Firebase Storage
                                    </>
                                )}
                            </button>

                            {uploadStatus === 'uploading' && (
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                        className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                            )}

                            {uploadStatus === 'success' && uploadedImageUrl && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center mb-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                            ¡Imagen subida exitosamente!
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => window.open(uploadedImageUrl, '_blank')}
                                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                        >
                                            Ver Imagen
                                        </button>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(uploadedImageUrl)}
                                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                        >
                                            Copiar URL
                                        </button>
                                    </div>
                                </div>
                            )}

                            {uploadStatus === 'error' && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <div className="flex items-center">
                                        <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                                        <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                            Error en la subida
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Management Help Section */}
            <div className="bg-[var(--input-bg)] rounded-lg border border-[var(--border)] p-6 mb-8">
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                    Gestión de Horarios - Exportar e Importar
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                            <h4 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-2">📥 Funcionalidad Export</h4>
                            <ul className="text-sm text-indigo-600 dark:text-indigo-300 space-y-1">
                                <li>✅ Filtros por rango de fechas</li>
                                <li>✅ Selección múltiple de ubicaciones</li>
                                <li>✅ Formato JSON con metadata</li>
                                <li>✅ Conteo de registros filtrados</li>
                                <li>✅ Descarga directa del archivo</li>
                            </ul>
                        </div>
                        
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">📤 Funcionalidad Import</h4>
                            <ul className="text-sm text-green-600 dark:text-green-300 space-y-1">
                                <li>✅ Validación de estructura JSON</li>
                                <li>✅ Detección de duplicados</li>
                                <li>✅ Vista previa antes de importar</li>
                                <li>✅ Progreso en tiempo real</li>
                                <li>✅ Manejo de errores individual</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <h4 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">🔧 Estructura del Archivo Export</h4>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
{`{
  "metadata": {
    "exportDate": "2025-01-01T00:00:00Z",
    "version": "1.0",
    "filters": {
      "dateFrom": "2024-12-01",
      "dateTo": "2024-12-31",
      "locations": ["LOCATION1", "LOCATION2"]
    },
    "totalRecords": 150
  },
  "schedules": [...],
  "locations": [...]
}`}
                            </pre>
                        </div>
                        
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 Casos de Uso</h4>
                            <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                                <li>• Backup de horarios por período</li>
                                <li>• Migración entre ambientes</li>
                                <li>• Compartir schedules entre ubicaciones</li>
                                <li>• Análisis histórico de horarios</li>
                                <li>• Restauración de datos</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-2">⚠️ Precauciones</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-orange-600 dark:text-orange-300 mb-2"><strong>Al Exportar:</strong></p>
                            <ul className="text-xs text-orange-600 dark:text-orange-300 space-y-1">
                                <li>• Verificar rango de fechas</li>
                                <li>• Seleccionar ubicaciones correctas</li>
                                <li>• Revisar conteo de registros</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm text-orange-600 dark:text-orange-300 mb-2"><strong>Al Importar:</strong></p>
                            <ul className="text-xs text-orange-600 dark:text-orange-300 space-y-1">
                                <li>• Los duplicados pueden sobrescribir</li>
                                <li>• Siempre hacer backup antes</li>
                                <li>• Verificar estructura del archivo</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Firebase Troubleshooting Section */}
            <div className="bg-[var(--input-bg)] rounded-lg border border-[var(--border)] p-6 mb-8">
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
                    Solución de Problemas Firebase Storage
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">Estado Actual de Firebase Storage</h4>
                            <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                                <li>✅ Reglas configuradas hasta 2026-07-25</li>
                                <li>✅ Carpeta /exports/ con acceso completo</li>
                                <li>⚠️ Falta regla específica para /test-images/</li>
                                <li>💡 Agregar regla para test-images en Firebase Console</li>
                            </ul>
                        </div>
                        
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <h4 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">Reglas Actuales de Storage</h4>
                            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Acceso completo a exports
    match /exports/{allPaths=**} {
      allow read, write: if true;
    }
    // Agregar esta regla para pruebas:
    match /test-images/{allPaths=**} {
      allow read, write: if true;
    }
    // Acceso temporal hasta 2026-07-25
    match /{allPaths=**} {
      allow read, write: if request.time < timestamp.date(2026, 7, 25);
    }
  }
}`}
                            </pre>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Variables de Entorno Requeridas</h4>
                            <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                                <li>• NEXT_PUBLIC_FIREBASE_API_KEY</li>
                                <li>• NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
                                <li>• NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
                                <li>• NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</li>
                                <li>• NEXT_PUBLIC_FIREBASE_APP_ID</li>
                            </ul>
                        </div>
                        
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">Pasos de Verificación</h4>
                            <ol className="text-sm text-green-600 dark:text-green-300 space-y-1">
                                <li>1. Ejecutar test de conexión Firebase</li>
                                <li>2. Verificar configuración en .env.local</li>
                                <li>3. Comprobar reglas de Storage</li>
                                <li>4. Intentar subir imagen de prueba</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[var(--input-bg)] rounded-lg border border-[var(--border)] p-6">
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
                    <FlaskConical className="w-5 h-5 mr-2 text-orange-600" />
                    Acciones Rápidas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => handleRunTest('full-suite', 'Suite Completa')}
                        disabled={activeTest === 'full-suite'}
                        className="px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                    >
                        {activeTest === 'full-suite' ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Ejecutando...
                            </>
                        ) : (
                            <>
                                <Beaker className="w-4 h-4 mr-2" />
                                Ejecutar Todo
                            </>
                        )}
                    </button>
                    
                    <button
                        onClick={() => setTestResults({})}
                        className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                        Limpiar Resultados
                    </button>
                    
                    <button
                        onClick={() => console.log('Exportando resultados...', testResults)}
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                        Exportar Resultados
                    </button>
                    
                    <button
                        onClick={() => window.location.hash = ''}
                        className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200"
                    >
                        Volver al Menú
                    </button>
                </div>
            </div>

            {/* Results Summary */}
            {Object.keys(testResults).length > 0 && (
                <div className="mt-6 bg-[var(--input-bg)] rounded-lg border border-[var(--border)] p-6">
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                        📊 Resumen de Resultados ({Object.keys(testResults).length} pruebas ejecutadas)
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Object.entries(testResults).map(([testId, result]) => (
                            <div key={testId} className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)]">
                                <div className="text-sm text-[var(--foreground)]">{result}</div>
                                <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                    ID: {testId} • {new Date().toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
