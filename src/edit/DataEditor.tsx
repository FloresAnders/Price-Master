// src/edit/DataEditor.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Download, Upload, AlertCircle, Check, FileText, MapPin, Users, Clock, DollarSign, Eye, EyeOff } from 'lucide-react';
import { LocationsService } from '../services/locations';
import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { CcssConfigService } from '../services/ccss-config';
import { Location, Sorteo, User, CcssConfig } from '../types/firestore';
import ScheduleReportTab from '../components/ScheduleReportTab';

type DataFile = 'locations' | 'sorteos' | 'users' | 'schedules' | 'ccss';

export default function DataEditor() {
    const [activeFile, setActiveFile] = useState<DataFile>('locations');
    const [locationsData, setLocationsData] = useState<Location[]>([]);
    const [sorteosData, setSorteosData] = useState<Sorteo[]>([]);
    const [usersData, setUsersData] = useState<User[]>([]);
    const [ccssData, setCcssData] = useState<CcssConfig>({ mt: 3672.46, tc: 11017.39 });
    const [originalLocationsData, setOriginalLocationsData] = useState<Location[]>([]);
    const [originalSorteosData, setOriginalSorteosData] = useState<Sorteo[]>([]);
    const [originalUsersData, setOriginalUsersData] = useState<User[]>([]);
    const [originalCcssData, setOriginalCcssData] = useState<CcssConfig>({ mt: 3672.46, tc: 11017.39 });
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [passwordVisibility, setPasswordVisibility] = useState<{ [key: number]: boolean }>({});
    const [savingUser, setSavingUser] = useState<number | null>(null);    // Detectar cambios
    useEffect(() => {
        const locationsChanged = JSON.stringify(locationsData) !== JSON.stringify(originalLocationsData);
        const sorteosChanged = JSON.stringify(sorteosData) !== JSON.stringify(originalSorteosData);
        const usersChanged = JSON.stringify(usersData) !== JSON.stringify(originalUsersData);
        const ccssChanged = JSON.stringify(ccssData) !== JSON.stringify(originalCcssData);
        setHasChanges(locationsChanged || sorteosChanged || usersChanged || ccssChanged);
    }, [locationsData, sorteosData, usersData, ccssData, originalLocationsData, originalSorteosData, originalUsersData, originalCcssData]);const loadData = useCallback(async () => {
        try {
            // Cargar locations desde Firebase
            const locations = await LocationsService.getAllLocations();            // Migrar datos del array names al array employees si es necesario
            const migratedLocations = locations.map(location => {
                // Si no tiene employees pero sí tiene names, migrar
                if ((!location.employees || location.employees.length === 0) && location.names && location.names.length > 0) {
                    return {
                        ...location,                        employees: location.names.map(name => ({
                            name,
                            ccssType: 'TC' as const, // Tiempo Completo por defecto
                            extraAmount: 0, // Monto extra inicial
                            hoursPerShift: 8 // Horas por turno predeterminadas
                        }))
                    };
                }
                // Si no tiene employees, inicializar array vacío
                if (!location.employees) {
                    return {
                        ...location,
                        employees: []
                    };                }
                // Asegurar que los empleados existentes tengan extraAmount y hoursPerShift
                return {
                    ...location,
                    employees: location.employees.map(emp => ({
                        ...emp,
                        extraAmount: emp.extraAmount !== undefined ? emp.extraAmount : 0,
                        hoursPerShift: emp.hoursPerShift !== undefined ? emp.hoursPerShift : 8
                    }))
                };
            });

            setLocationsData(migratedLocations);
            setOriginalLocationsData(JSON.parse(JSON.stringify(migratedLocations)));            // Cargar sorteos desde Firebase
            const sorteos = await SorteosService.getAllSorteos();
            setSorteosData(sorteos);
            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteos)));

            // Cargar usuarios desde Firebase
            const users = await UsersService.getAllUsers();
            setUsersData(users);
            setOriginalUsersData(JSON.parse(JSON.stringify(users)));

            // Cargar configuración CCSS desde Firebase
            const ccssConfig = await CcssConfigService.getCcssConfig();
            setCcssData(ccssConfig);
            setOriginalCcssData(JSON.parse(JSON.stringify(ccssConfig)));

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
                // Asegurar compatibilidad hacia atrás manteniendo names
                const namesToSave = location.employees
                    ? location.employees.map(emp => emp.name)
                    : location.names || [];

                await LocationsService.addLocation({
                    label: location.label,
                    value: location.value,
                    names: namesToSave, // Mantener compatibilidad hacia atrás
                    employees: location.employees || [] // Nueva estructura con tipo CCSS
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
            }            // Guardar usuarios en Firebase
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

            // Guardar configuración CCSS en Firebase
            await CcssConfigService.updateCcssConfig({
                mt: ccssData.mt,
                tc: ccssData.tc
            });

            // Guardar también en localStorage como respaldo
            localStorage.setItem('editedLocations', JSON.stringify(locationsData));
            localStorage.setItem('editedSorteos', JSON.stringify(sorteosData));            localStorage.setItem('editedUsers', JSON.stringify(usersData));

            setOriginalLocationsData(JSON.parse(JSON.stringify(locationsData)));
            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteosData)));
            setOriginalUsersData(JSON.parse(JSON.stringify(usersData)));
            setOriginalCcssData(JSON.parse(JSON.stringify(ccssData)));

            showNotification('¡Datos actualizados exitosamente en Firebase!', 'success');
        } catch (error) {
            showNotification('Error al guardar los datos en Firebase', 'error');
            console.error('Error saving data to Firebase:', error);
        } finally {
            setIsSaving(false);
        }
    };    const exportData = () => {
        const dataToExport = {
            locations: locationsData,
            sorteos: sorteosData,
            users: usersData,
            ccssConfig: ccssData,
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
                            setSorteosData(formattedSorteos);
                        } else {
                            // Ya está en formato de objetos - mantener solo name
                            const formattedSorteos = importedData.sorteos.map((sorteo: { name?: string }) => ({
                                name: sorteo.name || ''
                            }));
                            setSorteosData(formattedSorteos);
                        }
                    }
                }                if (importedData.users && Array.isArray(importedData.users)) {
                    setUsersData(importedData.users);
                }

                if (importedData.ccssConfig && typeof importedData.ccssConfig === 'object') {
                    const ccssConfig = importedData.ccssConfig;
                    if (typeof ccssConfig.mt === 'number' && typeof ccssConfig.tc === 'number') {
                        setCcssData({
                            mt: ccssConfig.mt,
                            tc: ccssConfig.tc
                        });
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
    };    // Funciones para manejar locations
    const addLocation = () => {
        const newLocation: Location = {
            value: '',
            label: '',
            names: [], // Mantener compatibilidad hacia atrás
            employees: [] // Nueva estructura para empleados con tipo CCSS
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
    }; const addEmployeeName = (locationIndex: number) => {
        const updated = [...locationsData];
        // Asegurar que existe el array de employees
        if (!updated[locationIndex].employees) {
            updated[locationIndex].employees = [];
        }        // Agregar nuevo empleado con tipo CCSS por defecto
        updated[locationIndex].employees!.push({
            name: '',
            ccssType: 'TC', // Tiempo Completo por defecto
            extraAmount: 0, // Monto extra inicial
            hoursPerShift: 8 // Horas por turno predeterminadas
        });
        setLocationsData(updated);
    };

    const updateEmployeeName = (locationIndex: number, employeeIndex: number, value: string) => {
        const updated = [...locationsData];
        if (updated[locationIndex].employees) {
            updated[locationIndex].employees[employeeIndex].name = value;
        }
        setLocationsData(updated);
    };

    const updateEmployeeCcssType = (locationIndex: number, employeeIndex: number, value: 'TC' | 'MT') => {
        const updated = [...locationsData];
        if (updated[locationIndex].employees) {
            updated[locationIndex].employees[employeeIndex].ccssType = value;
        }
        setLocationsData(updated);
    };

    const updateEmployeeExtraAmount = (locationIndex: number, employeeIndex: number, value: number) => {
        const updated = [...locationsData];
        if (updated[locationIndex].employees) {
            updated[locationIndex].employees[employeeIndex].extraAmount = value;
        }
        setLocationsData(updated);
    };

    const updateEmployeeHoursPerShift = (locationIndex: number, employeeIndex: number, value: number) => {
        const updated = [...locationsData];
        if (updated[locationIndex].employees) {
            updated[locationIndex].employees[employeeIndex].hoursPerShift = value;
        }
        setLocationsData(updated);
    };

    const removeEmployeeName = (locationIndex: number, employeeIndex: number) => {
        const updated = [...locationsData];
        if (updated[locationIndex].employees) {
            updated[locationIndex].employees = updated[locationIndex].employees.filter((_, i) => i !== employeeIndex);
        }
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
    }; const removeUser = (index: number) => {
        setUsersData(usersData.filter((_, i) => i !== index));
    };

    // Funciones para manejar visibilidad de contraseñas
    const togglePasswordVisibility = (index: number) => {
        setPasswordVisibility(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Función para guardar usuario individual
    const saveIndividualUser = async (index: number) => {
        setSavingUser(index);
        try {
            const user = usersData[index];
            if (user.id) {
                // Actualizar usuario existente
                await UsersService.updateUser(user.id, {
                    name: user.name,
                    location: user.location,
                    password: user.password,
                    role: user.role,
                    isActive: user.isActive
                });
            } else {
                // Crear nuevo usuario
                await UsersService.addUser({
                    name: user.name,
                    location: user.location,
                    password: user.password,
                    role: user.role,
                    isActive: user.isActive
                });
                // Recargar datos para obtener el ID generado
                await loadData();
            }
            showNotification(`Usuario ${user.name} guardado exitosamente`, 'success');
        } catch (error) {
            showNotification('Error al guardar el usuario', 'error');
            console.error('Error saving user:', error);
        } finally {
            setSavingUser(null);
        }
    };

    // Funciones para manejar configuración CCSS
    const updateCcssConfig = (field: 'mt' | 'tc', value: number) => {
        setCcssData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">            {/* Loading Modal */}
            {isSaving && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-[var(--card-bg)] rounded-xl p-8 flex flex-col items-center justify-center shadow-2xl border border-[var(--input-border)] max-w-sm mx-4 animate-scale-in">
                        <div className="relative flex items-center justify-center mb-6">
                            {/* Outer pulse ring */}
                            <div className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20"></div>
                            {/* Clock SVG */}
                            <svg className="animate-spin w-16 h-16 text-blue-600 relative z-10" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="4" opacity="0.2" />
                                <line x1="24" y1="24" x2="24" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                <line x1="24" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div className="text-xl font-semibold text-[var(--foreground)] mb-3">
                            Guardando cambios...
                        </div>
                        <div className="text-sm text-[var(--muted-foreground)] text-center leading-relaxed">
                            Por favor espera mientras se actualizan<br />
                            los datos en Firebase
                        </div>
                          {/* Progress bar animation */}
                        <div className="w-full max-w-xs mt-4">
                            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-transparent via-blue-600 to-transparent rounded-full animate-shimmer bg-[length:200%_100%]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Notification */}
            {notification && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in ${notification.type === 'success' ? 'bg-green-500' :
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
                            : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
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
                    <nav className="-mb-px flex space-x-8">                        <button
                        onClick={() => setActiveFile('locations')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'locations'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                            }`}
                    >
                        <MapPin className="w-4 h-4" />
                        Ubicaciones ({locationsData.length})
                    </button>
                        <button
                            onClick={() => setActiveFile('sorteos')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'sorteos'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Sorteos ({sorteosData.length})
                        </button>                        <button
                            onClick={() => setActiveFile('users')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'users'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Usuarios ({usersData.length})
                        </button>
                        <button
                            onClick={() => setActiveFile('schedules')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'schedules'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                                }`}
                        >
                            <Clock className="w-4 h-4" />
                            Planilla
                        </button>
                        <button
                            onClick={() => setActiveFile('ccss')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'ccss'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                                }`}
                        >
                            <DollarSign className="w-4 h-4" />
                            Pago CCSS
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
                            </div>                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">Empleados:</label>
                                    <button
                                        onClick={() => addEmployeeName(locationIndex)}
                                        className="text-sm bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                    >
                                        Agregar Empleado
                                    </button>
                                </div>                                <div className="space-y-3">
                                    {/* Migrar empleados del array names si existe */}
                                    {location.names && location.names.length > 0 && !location.employees?.length && (
                                        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                                            ⚠️ Empleados en formato anterior detectados. Se migrarán automáticamente al guardar.
                                        </div>
                                    )}

                                    {/* Header para claridad */}
                                    {location.employees && location.employees.length > 0 && (
                                        <div className="flex gap-2 items-center p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm font-medium">
                                            <div className="flex-1">Nombre del Empleado</div>
                                            <div className="w-40 text-center">Tipo CCSS</div>
                                            <div className="w-32 text-center">Monto Extra (₡)</div>
                                            <div className="w-32 text-center">Horas por Turno</div>
                                            <div className="w-10"></div>
                                        </div>
                                    )}

                                    {/* Mostrar empleados con nueva estructura */}
                                    {location.employees?.map((employee, employeeIndex) => (
                                        <div key={employeeIndex} className="flex gap-2 items-center p-3 border border-[var(--input-border)] rounded-md">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={employee.name}
                                                    onChange={(e) => updateEmployeeName(locationIndex, employeeIndex, e.target.value)}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                    placeholder="Nombre del empleado"
                                                />
                                            </div>
                                            <div className="w-40">
                                                <select
                                                    value={employee.ccssType}
                                                    onChange={(e) => updateEmployeeCcssType(locationIndex, employeeIndex, e.target.value as 'TC' | 'MT')}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md text-sm"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                >
                                                    <option value="TC">Tiempo Completo</option>
                                                    <option value="MT">Medio Tiempo</option>
                                                </select>
                                            </div>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    min=""
                                                    step="0.01"
                                                    value={employee.extraAmount || 0}
                                                    onChange={(e) => updateEmployeeExtraAmount(locationIndex, employeeIndex, parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md text-sm"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                    placeholder="Monto extra"
                                                    title="Monto extra en colones"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={employee.hoursPerShift}
                                                    onChange={(e) => updateEmployeeHoursPerShift(locationIndex, employeeIndex, parseInt(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md text-sm"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                    placeholder="Horas por turno"
                                                    title="Cantidad de horas por turno"
                                                />                                            </div>
                                            <button
                                                onClick={() => removeEmployeeName(locationIndex, employeeIndex)}
                                                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                                title="Eliminar empleado"
                                            >
                                                X
                                            </button>
                                        </div>
                                    ))}

                                    {/* Si no hay empleados en la nueva estructura, mostrar mensaje */}
                                    {(!location.employees || location.employees.length === 0) && (!location.names || location.names.length === 0) && (
                                        <div className="text-center py-4 text-[var(--muted-foreground)] border-2 border-dashed border-[var(--border)] rounded-md">
                                            No hay empleados agregados
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => removeLocation(locationIndex)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
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
                                    <div className="relative">
                                        <input
                                            type={passwordVisibility[index] ? 'text' : 'password'}
                                            value={user.password || ''}
                                            onChange={(e) => updateUser(index, 'password', e.target.value)}
                                            className="w-full px-3 py-2 pr-10 border border-[var(--input-border)] rounded-md"
                                            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                            placeholder="Contraseña del usuario"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility(index)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                            title={passwordVisibility[index] ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        >
                                            {passwordVisibility[index] ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Rol:</label>
                                    <select
                                        value={user.role || 'user'} onChange={(e) => updateUser(index, 'role', e.target.value as 'admin' | 'user' | 'superadmin')}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    >
                                        <option value="user">Usuario</option>
                                        <option value="admin">Administrador</option>
                                        <option value="superadmin">Super Administrador</option>
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
                                            className="w-4 h-4 text-blue-600 bg-[var(--background)] border-[var(--border)] rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm">Usuario activo</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => saveIndividualUser(index)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                                    disabled={savingUser === index}
                                >
                                    <Save className="w-4 h-4" />
                                    {savingUser === index ? 'Guardando...' : 'Guardar'}
                                </button>
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

            {/* Schedule Report Content */}
            {activeFile === 'schedules' && (
                <ScheduleReportTab />
            )}            {/* CCSS Payment Configuration */}
            {activeFile === 'ccss' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-xl font-semibold flex items-center gap-2">
                                <DollarSign className="w-6 h-6 text-green-600" />
                                Configuración de Pago CCSS
                            </h4>
                            <p className="text-sm text-[var(--muted-foreground)] mt-1">
                                Configurar los montos de pago a la Caja Costarricense de Seguro Social (CCSS)
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h5 className="font-medium text-blue-900 dark:text-blue-300">Información importante</h5>
                                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                                    Estos valores se utilizan para calcular los pagos de planilla según el tipo de empleado (Tiempo Completo o Medio Tiempo).
                                    Los cambios se reflejarán automáticamente en los cálculos de nómina.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Tiempo Completo */}
                        <div className="border border-[var(--input-border)] rounded-lg p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h5 className="font-semibold text-lg">Tiempo Completo (TC)</h5>
                                    <p className="text-sm text-[var(--muted-foreground)]">Empleados de jornada completa</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <label className="block text-sm font-medium">Monto CCSS:</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)]">₡</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={ccssData.tc}
                                        onChange={(e) => updateCcssConfig('tc', parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-3 border border-[var(--input-border)] rounded-md text-lg font-semibold"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="11017.39"
                                    />
                                </div>
                                <p className="text-xs text-[var(--muted-foreground)]">
                                    Valor por defecto: ₡11,017.39
                                </p>
                            </div>
                        </div>

                        {/* Medio Tiempo */}
                        <div className="border border-[var(--input-border)] rounded-lg p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-orange-600" />
                                </div>
                                <div>
                                    <h5 className="font-semibold text-lg">Medio Tiempo (MT)</h5>
                                    <p className="text-sm text-[var(--muted-foreground)]">Empleados de media jornada</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <label className="block text-sm font-medium">Monto CCSS:</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)]">₡</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={ccssData.mt}
                                        onChange={(e) => updateCcssConfig('mt', parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-3 border border-[var(--input-border)] rounded-md text-lg font-semibold"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="3672.46"
                                    />
                                </div>
                                <p className="text-xs text-[var(--muted-foreground)]">
                                    Valor por defecto: ₡3,672.46
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Resumen de configuración */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
                        <h5 className="font-semibold mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Resumen de Configuración
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-foreground)]">Tiempo Completo (TC):</span>
                                <span className="font-medium">₡{ccssData.tc.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-foreground)]">Medio Tiempo (MT):</span>
                                <span className="font-medium">₡{ccssData.mt.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        
                        {ccssData.updatedAt && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)]">
                                <p className="text-xs text-[var(--muted-foreground)]">
                                    Última actualización: {new Date(ccssData.updatedAt).toLocaleString('es-CR')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Botón para resetear valores por defecto */}
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => {
                                if (confirm('¿Estás seguro de que quieres restaurar los valores por defecto?')) {
                                    updateCcssConfig('tc', 11017.39);
                                    updateCcssConfig('mt', 3672.46);
                                }
                            }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                        >
                            Restaurar Valores Por Defecto
                        </button>
                        
                        <button
                            onClick={saveData}
                            disabled={!hasChanges || isSaving}
                            className={`px-6 py-2 rounded-md flex items-center gap-2 transition-colors ${hasChanges && !isSaving
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
                                }`}
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
