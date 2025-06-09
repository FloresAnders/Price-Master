// src/edit/DataEditor.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Download, Upload, AlertCircle, Check, FileText, MapPin } from 'lucide-react';

type DataFile = 'locations' | 'sorteos';

interface Location {
    value: string;
    label: string;
    names: string[];
}

interface Sorteo {
    id: number;
    name: string;
    time: string;
    active: boolean;
}

// Type for the raw sorteos JSON data (array of strings)
type RawSorteosData = string[];

export default function DataEditor() {
    const [activeFile, setActiveFile] = useState<DataFile>('locations');
    const [locationsData, setLocationsData] = useState<Location[]>([]);
    const [sorteosData, setSorteosData] = useState<Sorteo[]>([]);    const [originalLocationsData, setOriginalLocationsData] = useState<Location[]>([]);
    const [originalSorteosData, setOriginalSorteosData] = useState<Sorteo[]>([]);
    const [hasChanges, setHasChanges] = useState(false);    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Detectar cambios
    useEffect(() => {
        const locationsChanged = JSON.stringify(locationsData) !== JSON.stringify(originalLocationsData);
        const sorteosChanged = JSON.stringify(sorteosData) !== JSON.stringify(originalSorteosData);
        setHasChanges(locationsChanged || sorteosChanged);    }, [locationsData, sorteosData, originalLocationsData, originalSorteosData]);

    const loadData = useCallback(async () => {
        try {
            // Cargar locations
            const locationsResponse = await fetch('/api/data/locations');
            if (locationsResponse.ok) {
                const locations = await locationsResponse.json();
                setLocationsData(locations);
                setOriginalLocationsData(JSON.parse(JSON.stringify(locations)));
            } else {
                // Fallback: usar import dinámico
                const { default: locations } = await import('../data/locations.json');
                setLocationsData(locations);
                setOriginalLocationsData(JSON.parse(JSON.stringify(locations)));
            }      // Cargar sorteos
            const sorteosResponse = await fetch('/api/data/sorteos');
            if (sorteosResponse.ok) {
                const sorteos = await sorteosResponse.json();
                // Si es un array de strings, convertir a formato Sorteo
                const formattedSorteos = Array.isArray(sorteos) && sorteos.length > 0 && typeof sorteos[0] === 'string'
                    ? sorteos.map((name: string, index: number) => ({
                        id: index + 1,
                        name,
                        time: '',
                        active: true
                    }))
                    : sorteos;
                setSorteosData(formattedSorteos);
                setOriginalSorteosData(JSON.parse(JSON.stringify(formattedSorteos)));
            } else {
                // Fallback: usar import dinámico
                const { default: sorteos }: { default: RawSorteosData } = await import('../data/sorteos.json');
                // Convertir array de strings a formato Sorteo
                const formattedSorteos = sorteos.map((name: string, index: number) => ({
                    id: index + 1,
                    name,
                    time: '',
                    active: true
                }));
                setSorteosData(formattedSorteos);
                setOriginalSorteosData(JSON.parse(JSON.stringify(formattedSorteos)));
            }        } catch (error) {
            showNotification('Error al cargar los datos', 'error');
            console.error('Error loading data:', error);
        }    }, []);

    // Cargar datos iniciales
    useEffect(() => {
        loadData();
    }, [loadData]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };    const saveData = async () => {
        setIsSaving(true);
        try {
            // Guardar locations
            const locationsResponse = await fetch('/api/data/locations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(locationsData),
            });

            if (!locationsResponse.ok) {
                throw new Error('Failed to save locations');
            }

            // Guardar sorteos
            const sorteosResponse = await fetch('/api/data/sorteos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sorteosData),
            });

            if (!sorteosResponse.ok) {
                throw new Error('Failed to save sorteos');
            }

            // Guardar también en localStorage como respaldo
            localStorage.setItem('editedLocations', JSON.stringify(locationsData));
            localStorage.setItem('editedSorteos', JSON.stringify(sorteosData));

            setOriginalLocationsData(JSON.parse(JSON.stringify(locationsData)));
            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteosData)));

            showNotification('¡Archivos JSON actualizados exitosamente!', 'success');
        } catch (error) {
            showNotification('Error al guardar los datos en los archivos', 'error');
            console.error('Error saving data:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const exportData = () => {
        const dataToExport = {
            locations: locationsData,
            sorteos: sorteosData,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Datos exportados exitosamente', 'success');
    };    const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target?.result as string);

                if (importedData.locations && Array.isArray(importedData.locations)) {
                    setLocationsData(importedData.locations);
                }

                if (importedData.sorteos && Array.isArray(importedData.sorteos)) {
                    // Manejar tanto formato de strings como de objetos
                    if (importedData.sorteos.length > 0) {
                        if (typeof importedData.sorteos[0] === 'string') {
                            // Convertir array de strings a formato Sorteo
                            const formattedSorteos = importedData.sorteos.map((name: string, index: number) => ({
                                id: index + 1,
                                name,
                                time: '',
                                active: true
                            }));
                            setSorteosData(formattedSorteos);
                        } else {
                            // Ya está en formato de objetos
                            setSorteosData(importedData.sorteos);
                        }
                    }
                }

                showNotification('Datos importados exitosamente', 'success');
            } catch (error) {
                showNotification('Error al importar los datos. Formato inválido', 'error');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);

        // Reset input
        event.target.value = '';
    };

    // Funciones para manejar locations
    const addLocation = () => {
        const newLocation: Location = {
            value: '',
            label: '',
            names: []
        };
        setLocationsData([...locationsData, newLocation]);
    };

    const updateLocation = (index: number, field: keyof Location, value: string | string[]) => {
        const updated = [...locationsData];
        updated[index] = { ...updated[index], [field]: value };
        setLocationsData(updated);
    };

    const removeLocation = (index: number) => {
        setLocationsData(locationsData.filter((_, i) => i !== index));
    };

    const addEmployeeName = (locationIndex: number) => {
        const updated = [...locationsData];
        updated[locationIndex].names.push('');
        setLocationsData(updated);
    };

    const updateEmployeeName = (locationIndex: number, nameIndex: number, value: string) => {
        const updated = [...locationsData];
        updated[locationIndex].names[nameIndex] = value;
        setLocationsData(updated);
    };

    const removeEmployeeName = (locationIndex: number, nameIndex: number) => {
        const updated = [...locationsData];
        updated[locationIndex].names = updated[locationIndex].names.filter((_, i) => i !== nameIndex);
        setLocationsData(updated);
    };

    // Funciones para manejar sorteos
    const addSorteo = () => {
        const newSorteo: Sorteo = {
            id: Math.max(...sorteosData.map(s => s.id), 0) + 1,
            name: '',
            time: '',
            active: true
        };
        setSorteosData([...sorteosData, newSorteo]);
    };

    const updateSorteo = (index: number, field: keyof Sorteo, value: string | number | boolean) => {
        const updated = [...sorteosData];
        updated[index] = { ...updated[index], [field]: value };
        setSorteosData(updated);
    };

    const removeSorteo = (index: number) => {
        setSorteosData(sorteosData.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down ${notification.type === 'success' ? 'bg-green-500' :
                        notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    } text-white`}>
                    {notification.type === 'success' && <Check className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {notification.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                        <h3 className="text-xl font-semibold">Editor de Datos</h3>
                        <p className="text-sm text-[var(--tab-text)]">
                            Editar archivos de configuración de la aplicación
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                            <AlertCircle className="w-4 h-4" />
                            Cambios sin guardar
                        </div>
                    )}                    <button
                        onClick={saveData}
                        disabled={!hasChanges || isSaving}
                        className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${hasChanges && !isSaving
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>

                    <button
                        onClick={exportData}
                        className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>

                    <label className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Importar
                        <input
                            type="file"
                            accept=".json"
                            onChange={importData}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            {/* File Tabs */}
            <div className="mb-6">
                <div className="border-b border-[var(--input-border)]">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveFile('locations')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'locations'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-gray-300'
                                }`}
                        >
                            <MapPin className="w-4 h-4" />
                            Ubicaciones ({locationsData.length})
                        </button>
                        <button
                            onClick={() => setActiveFile('sorteos')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'sorteos'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-gray-300'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Sorteos ({sorteosData.length})
                        </button>
                    </nav>
                </div>
            </div>

            {/* Content */}
            {activeFile === 'locations' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-semibold">Configuración de Ubicaciones</h4>
                        <button
                            onClick={addLocation}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Agregar Ubicación
                        </button>
                    </div>

                    {locationsData.map((location, locationIndex) => (
                        <div key={locationIndex} className="border border-[var(--input-border)] rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Valor:</label>
                                    <input
                                        type="text"
                                        value={location.value}
                                        onChange={(e) => updateLocation(locationIndex, 'value', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Etiqueta:</label>
                                    <input
                                        type="text"
                                        value={location.label}
                                        onChange={(e) => updateLocation(locationIndex, 'label', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">Empleados:</label>
                                    <button
                                        onClick={() => addEmployeeName(locationIndex)}
                                        className="text-sm bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                    >
                                        Agregar Empleado
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {location.names.map((name, nameIndex) => (
                                        <div key={nameIndex} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => updateEmployeeName(locationIndex, nameIndex, e.target.value)}
                                                className="flex-1 px-3 py-2 border border-[var(--input-border)] rounded-md"
                                                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                placeholder="Nombre del empleado"
                                            />
                                            <button
                                                onClick={() => removeEmployeeName(locationIndex, nameIndex)}
                                                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => removeLocation(locationIndex)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Eliminar Ubicación
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeFile === 'sorteos' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-semibold">Configuración de Sorteos</h4>
                        <button
                            onClick={addSorteo}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Agregar Sorteo
                        </button>
                    </div>

                    {sorteosData.map((sorteo, index) => (                        <div key={sorteo.id} className="border border-[var(--input-border)] rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">ID:</label>
                                    <input
                                        type="number"
                                        value={sorteo.id}
                                        onChange={(e) => updateSorteo(index, 'id', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Nombre:</label>
                                    <input
                                        type="text"
                                        value={sorteo.name}
                                        onChange={(e) => updateSorteo(index, 'name', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={sorteo.active}
                                        onChange={(e) => updateSorteo(index, 'active', e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm font-medium">Activo</span>
                                </label>

                                <button
                                    onClick={() => removeSorteo(index)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Eliminar Sorteo
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
