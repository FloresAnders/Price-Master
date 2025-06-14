// src/edit/DataEditor.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Download, Upload, AlertCircle, Check, FileText, MapPin, Users } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { Location, Sorteo, User } from '../types/firestore';

type DataFile = 'locations' | 'sorteos' | 'users';

export default function DataEditor() {
    const [activeFile, setActiveFile] = useState<DataFile>('locations');
    const [locationsData, setLocationsData] = useState<Location[]>([]);
    const [sorteosData, setSorteosData] = useState<Sorteo[]>([]);
    const [usersData, setUsersData] = useState<User[]>([]);
    const [originalLocationsData, setOriginalLocationsData] = useState<Location[]>([]);
    const [originalSorteosData, setOriginalSorteosData] = useState<Sorteo[]>([]);
    const [originalUsersData, setOriginalUsersData] = useState<User[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Detectar cambios
    useEffect(() => {
        const locationsChanged = JSON.stringify(locationsData) !== JSON.stringify(originalLocationsData);
        const sorteosChanged = JSON.stringify(sorteosData) !== JSON.stringify(originalSorteosData);
        const usersChanged = JSON.stringify(usersData) !== JSON.stringify(originalUsersData);
        setHasChanges(locationsChanged || sorteosChanged || usersChanged);
    }, [locationsData, sorteosData, usersData, originalLocationsData, originalSorteosData, originalUsersData]);

    const loadData = useCallback(async () => {
        try {
            // Cargar locations desde Firebase
            const locations = await LocationsService.getAllLocations();
            setLocationsData(locations);
            setOriginalLocationsData(JSON.parse(JSON.stringify(locations)));

            // Cargar sorteos desde Firebase
            const sorteos = await SorteosService.getAllSorteos();
            setSorteosData(sorteos);
            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteos)));

            // Cargar usuarios desde Firebase
            const users = await UsersService.getAllUsers();
            setUsersData(users);
            setOriginalUsersData(JSON.parse(JSON.stringify(users)));

        } catch (error) {
            showNotification('Error al cargar los datos de Firebase', 'error');
            console.error('Error loading data from Firebase:', error);
        }
    }, []);

    // Cargar datos iniciales
    useEffect(() => {
        loadData();
    }, [loadData]);

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const saveData = async () => {
        setIsSaving(true);
        try {
            // Guardar locations en Firebase
            // Primero, eliminar los datos existentes y luego agregar los nuevos
            const existingLocations = await LocationsService.getAllLocations();
            for (const location of existingLocations) {
                if (location.id) {
                    await LocationsService.deleteLocation(location.id);
                }
            }
            
            // Agregar las nuevas locations
            for (const location of locationsData) {
                await LocationsService.addLocation({
                    label: location.label,
                    value: location.value,
                    names: location.names
                });
            }

            // Guardar sorteos en Firebase
            const existingSorteos = await SorteosService.getAllSorteos();
            for (const sorteo of existingSorteos) {
                if (sorteo.id) {
                    await SorteosService.deleteSorteo(sorteo.id);
                }
            }
            
            // Agregar los nuevos sorteos
            for (const sorteo of sorteosData) {
                await SorteosService.addSorteo({
                    name: sorteo.name
                });
            }

            // Guardar usuarios en Firebase
            const existingUsers = await UsersService.getAllUsers();
            for (const user of existingUsers) {
                if (user.id) {
                    await UsersService.deleteUser(user.id);
                }
            }
              // Agregar los nuevos usuarios
            for (const user of usersData) {
                await UsersService.addUser({
                    name: user.name,
                    location: user.location,
                    password: user.password,
                    role: user.role,
                    isActive: user.isActive
                });
            }

            // Guardar también en localStorage como respaldo
            localStorage.setItem('editedLocations', JSON.stringify(locationsData));
            localStorage.setItem('editedSorteos', JSON.stringify(sorteosData));
            localStorage.setItem('editedUsers', JSON.stringify(usersData));

            setOriginalLocationsData(JSON.parse(JSON.stringify(locationsData)));
            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteosData)));
            setOriginalUsersData(JSON.parse(JSON.stringify(usersData)));

            showNotification('¡Datos actualizados exitosamente en Firebase!', 'success');
        } catch (error) {
            showNotification('Error al guardar los datos en Firebase', 'error');
            console.error('Error saving data to Firebase:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const exportData = () => {
        const dataToExport = {
            locations: locationsData,
            sorteos: sorteosData,
            users: usersData,
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
    };

    const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                    // Manejar formato simplificado de sorteos
                    if (importedData.sorteos.length > 0) {
                        if (typeof importedData.sorteos[0] === 'string') {
                            // Convertir array de strings a formato Sorteo
                            const formattedSorteos = importedData.sorteos.map((name: string) => ({
                                name
                            }));
                            setSorteosData(formattedSorteos);                        } else {
                            // Ya está en formato de objetos - mantener solo name
                            const formattedSorteos = importedData.sorteos.map((sorteo: { name?: string }) => ({
                                name: sorteo.name || ''
                            }));
                            setSorteosData(formattedSorteos);
                        }
                    }
                }

                if (importedData.users && Array.isArray(importedData.users)) {
                    setUsersData(importedData.users);
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
            name: ''
        };
        setSorteosData([...sorteosData, newSorteo]);
    };

    const updateSorteo = (index: number, field: keyof Sorteo, value: string) => {
        const updated = [...sorteosData];
        updated[index] = { ...updated[index], [field]: value };
        setSorteosData(updated);
    };

    const removeSorteo = (index: number) => {
        setSorteosData(sorteosData.filter((_, i) => i !== index));
    };    // Funciones para manejar usuarios
    const addUser = () => {
        const newUser: User = {
            name: '',
            location: '',
            password: '',
            role: 'user',
            isActive: true
        };
        setUsersData([...usersData, newUser]);
    };

    const updateUser = (index: number, field: keyof User, value: string | boolean) => {
        const updated = [...usersData];
        updated[index] = { ...updated[index], [field]: value };
        setUsersData(updated);
    };    const removeUser = (index: number) => {
        setUsersData(usersData.filter((_, i) => i !== index));
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
                    )}
                    <button
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
                    </button>                    <label className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 transition-colors cursor-pointer">
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
                        <button
                            onClick={() => setActiveFile('users')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'users'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-gray-300'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Usuarios ({usersData.length})
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

                    {sorteosData.map((sorteo, index) => (
                        <div key={sorteo.id || index} className="border border-[var(--input-border)] rounded-lg p-4">
                            <div className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">Nombre del Sorteo:</label>
                                    <input
                                        type="text"
                                        value={sorteo.name}
                                        onChange={(e) => updateSorteo(index, 'name', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="Ingrese el nombre del sorteo"
                                    />
                                </div>

                                <button
                                    onClick={() => removeSorteo(index)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeFile === 'users' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-semibold">Configuración de Usuarios</h4>
                        <button
                            onClick={addUser}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Agregar Usuario
                        </button>
                    </div>

                    {usersData.map((user, index) => (
                        <div key={user.id || index} className="border border-[var(--input-border)] rounded-lg p-4">                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Nombre:</label>
                                    <input
                                        type="text"
                                        value={user.name}
                                        onChange={(e) => updateUser(index, 'name', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="Nombre del usuario"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Ubicación:</label>
                                    <select
                                        value={user.location || ''}
                                        onChange={(e) => updateUser(index, 'location', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    >
                                        <option value="">Seleccionar ubicación</option>
                                        {locationsData.map((location) => (
                                            <option key={location.value} value={location.value}>
                                                {location.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Contraseña:</label>
                                    <input
                                        type="password"
                                        value={user.password || ''}
                                        onChange={(e) => updateUser(index, 'password', e.target.value)}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="Contraseña del usuario"
                                    />
                                </div>                                <div>
                                    <label className="block text-sm font-medium mb-1">Rol:</label>
                                    <select
                                        value={user.role || 'user'}
                                        onChange={(e) => updateUser(index, 'role', e.target.value as 'admin' | 'user' | 'superadmin')}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    >
                                        <option value="user">Usuario</option>
                                        <option value="admin">Administrador</option>
                                        <option value="superadmin">SuperAdmin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Estado:</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={user.isActive ?? true}
                                            onChange={(e) => updateUser(index, 'isActive', e.target.checked)}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm">Usuario activo</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => removeUser(index)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Eliminar Usuario
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
