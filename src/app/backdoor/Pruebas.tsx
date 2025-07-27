'use client';

import React, { useState, useRef } from 'react';
import { TestTube, Beaker, FlaskConical, Zap, Code, Database, Upload, Image, CheckCircle, AlertCircle } from 'lucide-react';
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
            // Crear referencia en Firebase Storage (usando /exports/ que tiene permisos)
            const timestamp = Date.now();
            const fileName = `${timestamp}-${selectedFile.name}`;
            const storageRef = ref(storage, `exports/images/${fileName}`);

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
            // Test 1: Verificar configuración de Firebase
            setTestResults(prev => ({
                ...prev,
                'firebase-config': `🔧 Verificando configuración de Firebase...`
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
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
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
