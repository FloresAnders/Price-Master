// src/edit/DataEditor.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Download, AlertCircle, Check, FileText, Users, Clock, DollarSign, Eye, EyeOff, Settings } from 'lucide-react';
import { EmpresasService } from '../services/empresas';
import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { useAuth } from '../hooks/useAuth';
import { CcssConfigService } from '../services/ccss-config';
import { Sorteo, User, CcssConfig, UserPermissions } from '../types/firestore';
import { getDefaultPermissions, getNoPermissions } from '../utils/permissions';
import ScheduleReportTab from '../components/business/ScheduleReportTab';
import ConfirmModal from '../components/ui/ConfirmModal';
import ExportModal from '../components/export/ExportModal';

type DataFile = 'sorteos' | 'users' | 'schedules' | 'ccss' | 'empresas';

export default function DataEditor() {
    const [activeFile, setActiveFile] = useState<DataFile>('empresas');
    const { user: currentUser } = useAuth();
    const [sorteosData, setSorteosData] = useState<Sorteo[]>([]);
    const [usersData, setUsersData] = useState<User[]>([]);
    const [ccssData, setCcssData] = useState<CcssConfig>({ mt: 3672.46, tc: 11017.39, valorhora: 1441, horabruta: 1529.62 });
    const [empresasData, setEmpresasData] = useState<any[]>([]);
    const [originalEmpresasData, setOriginalEmpresasData] = useState<any[]>([]);
    const [originalSorteosData, setOriginalSorteosData] = useState<Sorteo[]>([]);
    const [originalUsersData, setOriginalUsersData] = useState<User[]>([]);
    const [originalCcssData, setOriginalCcssData] = useState<CcssConfig>({ mt: 3672.46, tc: 11017.39, valorhora: 1441, horabruta: 1529.62 });
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };
    // Resolve ownerId for created entities: prefer explicit provided value, then
    // currentUser.ownerId (when admin has an assigned owner), then try session
    // stored in localStorage, then fall back to currentUser.id when actor is
    // an admin with eliminate === false, otherwise empty string.
    const resolveOwnerIdForActor = (provided?: string) => {
        if (provided) return provided;
        // prefer explicit ownerId on currentUser
        if (currentUser?.ownerId) return currentUser.ownerId;
        // fallback to enriched session in browser
        if (typeof window !== 'undefined') {
            try {
                const sessionRaw = localStorage.getItem('pricemaster_session');
                if (sessionRaw) {
                    const session = JSON.parse(sessionRaw);
                    if (session && session.ownerId) return session.ownerId;
                    // if session indicates actor is not a delegated admin, use session.id
                    if (session && session.eliminate === false && session.id) return session.id;
                }
            } catch {
                // ignore parsing errors
            }
        }
        // finally, if currentUser is present and not marked as delegated (eliminate === false), use its id
        if (currentUser && currentUser.eliminate === false && currentUser.id) return currentUser.id;
        return '';
    };
    const [passwordVisibility, setPasswordVisibility] = useState<{ [key: string]: boolean }>({});
    const [savingUserKey, setSavingUserKey] = useState<string | null>(null);
    const [showPermissions, setShowPermissions] = useState<{ [key: string]: boolean }>({});
    const [permissionsEditable, setPermissionsEditable] = useState<{ [key: string]: boolean }>({});

    // Estado para trackear cambios individuales de ubicaciones (removed)

    // Estado para modal de confirmación
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: (() => void) | null;
        loading: boolean;
        singleButton?: boolean;
        singleButtonText?: string;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: null,
        loading: false,
        singleButton: false,
        singleButtonText: undefined
    });    // Detectar cambios

    // Helpers para modal de confirmación
    const openConfirmModal = (title: string, message: string, onConfirm: () => void, opts?: { singleButton?: boolean; singleButtonText?: string }) => {
        setConfirmModal({ open: true, title, message, onConfirm, loading: false, singleButton: opts?.singleButton, singleButtonText: opts?.singleButtonText });
    };

    const closeConfirmModal = () => {
        setConfirmModal({ open: false, title: '', message: '', onConfirm: null, loading: false, singleButton: false, singleButtonText: undefined });
    };

    const handleConfirm = async () => {
        if (confirmModal.onConfirm) {
            try {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                await Promise.resolve(confirmModal.onConfirm());
            } catch (error: unknown) {
                console.error('Error in confirm action:', error);
                const msg = error instanceof Error ? error.message : String(error || 'Error');
                showNotification(msg.includes('Forbidden') ? 'No tienes permisos para realizar esta acción' : 'Error al ejecutar la acción', 'error');
            } finally {
                closeConfirmModal();
            }
        }
    };
    useEffect(() => {
        const sorteosChanged = JSON.stringify(sorteosData) !== JSON.stringify(originalSorteosData);
        const usersChanged = JSON.stringify(usersData) !== JSON.stringify(originalUsersData);
        const ccssChanged = JSON.stringify(ccssData) !== JSON.stringify(originalCcssData);
        const empresasChanged = JSON.stringify(empresasData) !== JSON.stringify(originalEmpresasData);
        setHasChanges(sorteosChanged || usersChanged || ccssChanged || empresasChanged);
    }, [sorteosData, usersData, ccssData, empresasData, originalSorteosData, originalUsersData, originalCcssData, originalEmpresasData]);

    const loadData = useCallback(async () => {
        try {
            // Cargar sorteos desde Firebase
            const sorteos = await SorteosService.getAllSorteos();
            setSorteosData(sorteos);
            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteos)));

            // Cargar empresas desde Firebase
            try {
                const empresas = await EmpresasService.getAllEmpresas();
                setEmpresasData(empresas);
                setOriginalEmpresasData(JSON.parse(JSON.stringify(empresas)));
            } catch (err) {
                console.warn('No se pudo cargar empresas:', err);
                setEmpresasData([]);
                setOriginalEmpresasData([]);
            }

            // Cargar usuarios desde Firebase (solo si hay un usuario actual que actúe)
            if (currentUser) {
                const users = await UsersService.getAllUsersAs(currentUser);

                // Asegurar que todos los usuarios tengan todos los permisos disponibles
                try {
                    await UsersService.ensureAllPermissions();
                } catch (error) {
                    console.warn('Error ensuring all permissions:', error);
                }

                setUsersData(users);
                setOriginalUsersData(JSON.parse(JSON.stringify(users)));
            } else {
                // Si no hay currentUser (por ejemplo durante SSR/hydration temprana), inicializar vacíos
                setUsersData([]);
                setOriginalUsersData([]);
            }

            // Cargar configuración CCSS desde Firebase
            const ccssConfig = await CcssConfigService.getCcssConfig();
            setCcssData(ccssConfig);
            setOriginalCcssData(JSON.parse(JSON.stringify(ccssConfig)));

        } catch (error) {
            showNotification('Error al cargar los datos de Firebase', 'error');
            console.error('Error loading data from Firebase:', error);
        }
    }, [currentUser]);

    // Cargar datos al montar el componente o cuando cambie el usuario autenticado
    useEffect(() => {
        // Solo ejecutar la carga (loadData) cuando React haya inicializado el componente.
        // loadData internamente chequea `currentUser` antes de pedir usuarios.
        loadData();
    }, [loadData]);

    // Función para verificar si una ubicación específica ha cambiado (removed - locations tab deleted)

    // Función para verificar si un usuario específico ha cambiado
    // Helper: obtener key única para un usuario (id o __localId)
    const getUserKey = (user: User, index: number) => {
        return user.id ?? (user as unknown as { __localId?: string }).__localId ?? `tmp-${index}`;
    };

    const hasUserChanged = (index: number): boolean => {
        const currentUser = usersData[index];
        if (!currentUser) return false;

        // const key = getUserKey(currentUser, index);

        // Buscar original por id si existe
        let originalUser: User | null = null;
        if (currentUser.id) {
            originalUser = originalUsersData.find(u => u.id === currentUser.id) || null;
        } else {
            // intentar buscar por __localId si fue asignado previamente
            originalUser = originalUsersData.find(u => (u as unknown as { __localId?: string }).__localId === (currentUser as unknown as { __localId?: string }).__localId) || null;
        }

        if (!originalUser) return true;

        const sanitize = (u: User | null | undefined) => {
            if (!u) return u;
            const copy = { ...u } as Partial<User>;
            delete (copy as Partial<User>).createdAt;
            delete (copy as Partial<User>).updatedAt;
            return copy;
        };

        return JSON.stringify(sanitize(currentUser)) !== JSON.stringify(sanitize(originalUser));
    };

    const saveData = async () => {
        setIsSaving(true);
        try {
            // Guardar sorteos
            const existingSorteos = await SorteosService.getAllSorteos();
            for (const s of existingSorteos) { if (s.id) await SorteosService.deleteSorteo(s.id); }
            for (const s of sorteosData) { await SorteosService.addSorteo({ name: s.name }); }

            // Guardar usuarios
            const existingUsers = await UsersService.getAllUsers();
            for (const u of existingUsers) { if (u.id) { try { await UsersService.deleteUserAs(currentUser, u.id); } catch { } } }
            for (const u of usersData) {
                const perms = { ...(u.permissions || {}) } as Record<string, unknown>;
                await UsersService.createUserAs(currentUser, {
                    name: u.name,
                    ownercompanie: u.ownercompanie,
                    password: u.password,
                    role: u.role,
                    isActive: u.isActive,
                    permissions: perms as any,
                    maxCompanies: u.maxCompanies,
                    email: u.email,
                    fullName: u.fullName,
                    eliminate: u.eliminate ?? false,
                    ownerId: u.ownerId
                });
            }

            // Guardar configuración CCSS
            await CcssConfigService.updateCcssConfig({ mt: ccssData.mt, tc: ccssData.tc, valorhora: ccssData.valorhora, horabruta: ccssData.horabruta });

            // Guardar empresas
            try {
                const existingEmpresas = await EmpresasService.getAllEmpresas();
                for (const e of existingEmpresas) { if (e.id) await EmpresasService.deleteEmpresa(e.id); }
                for (const empresa of empresasData) {
                    const ownerIdToUse = resolveOwnerIdForActor(empresa.ownerId);
                    const idToUse = empresa.name || undefined;
                    await EmpresasService.addEmpresa({ id: idToUse, ownerId: ownerIdToUse, name: empresa.name || '', ubicacion: empresa.ubicacion || '', empleados: empresa.empleados || [] });
                }
            } catch (err) {
                console.warn('Error al guardar empresas:', err);
            }

            // Local backup and update originals
            localStorage.setItem('editedSorteos', JSON.stringify(sorteosData));
            localStorage.setItem('editedUsers', JSON.stringify(usersData));

            setOriginalSorteosData(JSON.parse(JSON.stringify(sorteosData)));
            setOriginalUsersData(JSON.parse(JSON.stringify(usersData)));
            setOriginalCcssData(JSON.parse(JSON.stringify(ccssData)));
            setOriginalEmpresasData(JSON.parse(JSON.stringify(empresasData)));

            setHasChanges(false);
            showNotification('¡Datos actualizados exitosamente en Firebase!', 'success');
        } catch (error) {
            console.error('Error saving data to Firebase:', error);
            showNotification('Error al guardar los datos en Firebase', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Estado y handlers para modal de exportación (por ahora muestra "Próximamente")
    const [showExportModal, setShowExportModal] = useState(false);
    const openExportModal = () => setShowExportModal(true);
    const closeExportModal = () => setShowExportModal(false);

    // Location helpers removed (locations tab deleted)

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
        const sorteo = sorteosData[index];
        const sorteoName = sorteo.name || `Sorteo ${index + 1}`;

        openConfirmModal(
            'Eliminar Sorteo',
            `¿Está seguro de que desea eliminar el sorteo "${sorteoName}"? Esta acción no se puede deshacer.`,
            () => {
                setSorteosData(sorteosData.filter((_, i) => i !== index));
            }
        );
    };    // Funciones para manejar usuarios
    const addUser = () => {
        const defaultRole: User['role'] = currentUser?.role === 'superadmin' ? 'admin' : 'user';
        const newUser: User = {
            name: '',
            ownercompanie: '',
            password: '',
            role: defaultRole,
            isActive: true
        };
        // Añadir campos solicitados: email, fullName y eliminate por defecto false
        (newUser as Partial<User>).email = '';
        (newUser as Partial<User>).fullName = '';
        (newUser as Partial<User>).eliminate = false;
        // Preselect ownerId for new users when actor has an owner
        (newUser as Partial<User>).ownerId = currentUser?.ownerId ?? (currentUser && currentUser.eliminate === false ? currentUser.id : '');
        // Insertar al inicio
        // Give new user no permissions by default (no privileges)
        newUser.permissions = getNoPermissions();
        // Assign a temporary local id so per-user keyed state can reference it
        const localId = `local-${Date.now()}`;
        (newUser as unknown as { __localId?: string }).__localId = localId;
        setUsersData(prev => [newUser, ...prev]);

        // Initialize per-user keyed UI state for the new user
        setPasswordVisibility(prev => ({ ...prev, [localId]: false }));
        setPermissionsEditable(prev => ({ ...prev, [localId]: true }));
        setShowPermissions(prev => ({ ...prev, [localId]: true }));
    };

    const updateUser = (index: number, field: keyof User, value: unknown) => {
        const updated = [...usersData];

        // No cambiar permisos automáticamente al cambiar rol. Solo actualizar campo.
        updated[index] = { ...updated[index], [field]: value };

        setUsersData(updated);
    };

    const removeUser = (index: number) => {
        const user = usersData[index];
        const userName = user.name || `Usuario ${index + 1}`;

        openConfirmModal(
            'Eliminar Usuario',
            `¿Está seguro de que desea eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`,
            async () => {
                try {
                    setConfirmModal(prev => ({ ...prev, loading: true }));

                    // Si el usuario tiene id, eliminar en backend primero con validación de actor
                    if (user.id) {
                        await UsersService.deleteUserAs(currentUser, user.id);
                    }

                    // Eliminar del estado local
                    setUsersData(prev => prev.filter((_, i) => i !== index));

                    // Actualizar originalUsersData para eliminarlo también
                    setOriginalUsersData(prev => prev.filter(u => u.id !== user.id && (u as unknown as { __localId?: string }).__localId !== (user as unknown as { __localId?: string }).__localId));

                    showNotification(`Usuario ${userName} eliminado exitosamente`, 'success');
                } catch (error: unknown) {
                    console.error('Error deleting user:', error);
                    const msg = error instanceof Error ? error.message : String(error || 'Error al eliminar el usuario');
                    showNotification(msg.includes('Forbidden') ? 'No tienes permisos para eliminar este usuario' : 'Error al eliminar el usuario', 'error');
                } finally {
                    // Cerrar modal y quitar loading
                    closeConfirmModal();
                }
            }
        );
    };

    // Funciones para manejar visibilidad de contraseñas
    const togglePasswordVisibility = (user: User, index: number) => {
        const key = getUserKey(user, index);
        setPasswordVisibility(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // showPermissions is toggled inline where needed

    // Note: permission-specific auto-save functions were removed because permissions are edited locally
    // and saved when the user presses the 'Guardar' button. Keep UsersService functions available
    // if needed elsewhere.

    // Función para habilitar/deshabilitar todos los permisos con guardado automático
    const setAllUserPermissions = (userIndex: number, value: boolean) => {
        const user = usersData[userIndex];
        const action = value ? 'habilitar todos' : 'deshabilitar todos';

        openConfirmModal(
            `${value ? 'Habilitar' : 'Deshabilitar'} Todos los Permisos`,
            `¿Estás seguro de ${action} los permisos para "${user.name}"?`,
            async () => {
                const updated = [...usersData];
                const permissionKeys: (keyof UserPermissions)[] = [
                    'scanner', 'calculator', 'converter', 'cashcounter',
                    'timingcontrol', 'controlhorario', 'supplierorders', 'mantenimiento', 'scanhistory'
                ];

                if (!updated[userIndex].permissions) {
                    updated[userIndex].permissions = getDefaultPermissions(updated[userIndex].role || 'user');
                }

                const newPermissions: Partial<UserPermissions> = {};
                permissionKeys.forEach(key => {
                    (updated[userIndex].permissions as unknown as Record<string, unknown>)![key] = value;
                    (newPermissions as unknown as Record<string, unknown>)[key] = value;
                });

                // Si se están desactivando todos los permisos, limpiar las empresas seleccionadas
                if (!value) {
                    updated[userIndex].permissions!.scanhistoryEmpresas = [];
                    newPermissions.scanhistoryEmpresas = [];
                }

                setUsersData(updated);

                // Guardar en base de datos si el usuario tiene ID
                if (user.id) {
                    try {
                        const key = getUserKey(user, userIndex);
                        setSavingUserKey(key);
                        await UsersService.updateUserPermissions(user.id, newPermissions);

                        setNotification({
                            message: `Todos los permisos ${value ? 'habilitados' : 'deshabilitados'} para ${user.name}`,
                            type: 'success'
                        });
                        setTimeout(() => setNotification(null), 3000);

                    } catch (error) {
                        console.error('Error updating all user permissions:', error);
                        setNotification({
                            message: `Error al actualizar permisos para ${user.name}`,
                            type: 'error'
                        });
                        setTimeout(() => setNotification(null), 5000);
                    } finally {
                        setSavingUserKey(null);
                    }
                }
            }
        );
    };

    // Función para obtener etiquetas de permisos
    const getPermissionLabel = (permission: string): string => {
        const labels: { [key: string]: string } = {
            scanner: 'Escáner',
            calculator: 'Calculadora',
            converter: 'Conversor',
            cashcounter: 'Contador Efectivo',
            timingcontrol: 'Control Tiempos',
            controlhorario: 'Control Horario',
            supplierorders: 'Órdenes Proveedor',
            mantenimiento: 'Mantenimiento',
            scanhistory: 'Historial de Escaneos',
        };
        return labels[permission] || permission;
    };

    // Función para obtener descripciones de permisos
    const getPermissionDescription = (permission: string): string => {
        const descriptions: { [key: string]: string } = {
            scanner: 'Escanear códigos de barras',
            calculator: 'Calcular precios con descuentos',
            converter: 'Convertir y transformar texto',
            cashcounter: 'Contar billetes y monedas',
            timingcontrol: 'Registro de venta de tiempos',
            controlhorario: 'Registro de horarios de trabajo',
            supplierorders: 'Gestión de órdenes de proveedores',
            mantenimiento: 'Acceso al panel de administración',
            scanhistory: 'Ver historial completo de escaneos realizados',
        };
        return descriptions[permission] || permission;
    };

    // Función para renderizar la lista de permisos editables
    const renderUserPermissions = (user: User, index: number) => {
        const defaultPermissions = getDefaultPermissions(user.role || 'user');
        const userPermissions = { ...defaultPermissions, ...(user.permissions || {}) };
        // allow editing permissions for new users; only disable while saving
        const key = getUserKey(user, index);
        const isDisabled = savingUserKey === key;

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Permisos de Usuario:</span>
                    <div className="flex gap-2 items-center">
                        {savingUserKey === key && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 dark:border-blue-400"></div>
                                <span>Guardando...</span>
                            </div>
                        )}
                        <button
                            onClick={() => setAllUserPermissions(index, true)}
                            disabled={isDisabled}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Habilitar Todo
                        </button>
                        <button
                            onClick={() => setAllUserPermissions(index, false)}
                            disabled={isDisabled}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Deshabilitar Todo
                        </button>
                        <button
                            onClick={() => setPermissionsEditable(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                            {permissionsEditable[key] ? 'Bloquear Permisos' : 'Editar Permisos'}
                        </button>
                        <button
                            onClick={() => setShowPermissions(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            {showPermissions[key] ? 'Vista Compacta' : 'Vista Detallada'}
                        </button>
                    </div>
                </div>

                {showPermissions[key] ? (
                    // Vista detallada con checkboxes editables
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(userPermissions)
                            .filter(([permission]) => permission !== 'scanhistoryEmpresas' && permission !== 'scanhistoryLocations')
                            .map(([permission, hasAccess]) => (
                                <div
                                    key={permission}
                                    className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${hasAccess
                                        ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                                        : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/70'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        id={`${index}-${permission}`}
                                        checked={Boolean(hasAccess)}
                                        disabled={!permissionsEditable[key] || isDisabled}
                                        onChange={(e) => {
                                            // Only update in local state; do not auto-save
                                            const updated = [...usersData];
                                            if (!updated[index].permissions) {
                                                updated[index].permissions = getDefaultPermissions(updated[index].role || 'user');
                                            }
                                            (updated[index].permissions as unknown as Record<string, unknown>)[permission] = e.target.checked;
                                            setUsersData(updated);
                                        }}
                                        className="w-5 h-5 text-green-600 border-2 rounded focus:ring-green-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{
                                            backgroundColor: 'var(--input-bg)',
                                            borderColor: 'var(--input-border)'
                                        }}
                                    />
                                    <label
                                        htmlFor={`${index}-${permission}`}
                                        className="cursor-pointer flex-1"
                                    >
                                        <div className="font-medium" style={{ color: 'var(--foreground)' }}>{getPermissionLabel(permission)}</div>
                                        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{getPermissionDescription(permission)}</div>
                                    </label>
                                    <div className={`px-2 py-1 rounded text-xs font-medium ${hasAccess
                                        ? 'bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}>
                                        {hasAccess ? 'Activo' : 'Inactivo'}
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : (
                    // Vista compacta con indicadores
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(userPermissions)
                            .filter(([permission]) => permission !== 'scanhistoryEmpresas' && permission !== 'scanhistoryLocations')
                            .map(([permission, hasAccess]) => (
                                <label
                                    key={permission}
                                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded cursor-pointer border transition-colors ${hasAccess
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-900/50'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={Boolean(hasAccess)}
                                        disabled={!permissionsEditable[key] || isDisabled}
                                        onChange={(e) => {
                                            const updated = [...usersData];
                                            if (!updated[index].permissions) {
                                                updated[index].permissions = getDefaultPermissions(updated[index].role || 'user');
                                            }
                                            (updated[index].permissions as unknown as Record<string, unknown>)[permission] = e.target.checked;
                                            setUsersData(updated);
                                        }}
                                        className="w-3 h-3 disabled:opacity-50"
                                    />
                                    <span>{getPermissionLabel(permission)}</span>
                                </label>
                            ))}
                    </div>
                )}

                {/* Selector de empresas para scanhistory */}
                {userPermissions.scanhistory && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <h4 className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                            Empresas para Historial de Escaneos
                        </h4>
                        <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
                            Selecciona las empresas específicas a las que este usuario tendrá acceso en el historial de escaneos.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {empresasData
                                .filter((empresa) => {
                                    // Mostrar solo empresas dentro del alcance del actor (ownerId match)
                                    const actorOwnerId = resolveOwnerIdForActor();
                                    if (!actorOwnerId) return true; // si no hay ownerId resuelto, mostrar todas
                                    return empresa.ownerId === actorOwnerId;
                                })
                                .map((empresa) => (
                                    <label
                                        key={empresa.id || empresa.name}
                                        className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        <input
                                            type="checkbox"
                                            // almacenamos por empresa.name para mantener compatibilidad con la estructura actual
                                            checked={userPermissions.scanhistoryEmpresas?.includes(empresa.name) || false}
                                            disabled={!permissionsEditable[key] || isDisabled}
                                            onChange={(e) => {
                                                const updated = [...usersData];
                                                if (!updated[index].permissions) {
                                                    updated[index].permissions = getDefaultPermissions(updated[index].role || 'user');
                                                }
                                                const current = updated[index].permissions!.scanhistoryEmpresas || [];
                                                const newList = e.target.checked ? [...current, empresa.name] : current.filter(l => l !== empresa.name);
                                                updated[index].permissions!.scanhistoryEmpresas = newList;
                                                setUsersData(updated);
                                            }}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                                        />
                                        <span style={{ color: 'var(--foreground)' }}>{empresa.name}</span>
                                    </label>
                                ))}
                        </div>
                        {userPermissions.scanhistoryEmpresas && userPermissions.scanhistoryEmpresas.length > 0 && (
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded">
                                <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                                    <strong>Empresas seleccionadas:</strong> {userPermissions.scanhistoryEmpresas.join(', ')}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Función para guardar usuario individual
    const saveIndividualUser = async (index: number) => {
        const key = getUserKey(usersData[index], index);
        setSavingUserKey(key);
        try {
            const user = usersData[index];
            if (user.id) {
                // Actualizar usuario existente (actor-aware)
                // Clean stale properties before saving
                const permissionsToSave = { ...(user.permissions || {}) } as Record<string, unknown>;
                await UsersService.updateUserAs(currentUser, user.id, {
                    name: user.name,
                    password: user.password,
                    role: user.role,
                    isActive: user.isActive,
                    permissions: permissionsToSave as any,
                    email: user.email,
                    fullName: user.fullName,
                    maxCompanies: user.maxCompanies,
                    eliminate: user.eliminate ?? false,
                    ownerId: user.ownerId,
                    ownercompanie: user.ownercompanie
                });
                // Actualizar originalUsersData para este usuario para reflejar que ya no hay cambios pendientes
                setOriginalUsersData(prev => {
                    try {
                        const copy = JSON.parse(JSON.stringify(prev)) as User[];
                        const idx = copy.findIndex(u => u.id === user.id);
                        if (idx !== -1) {
                            copy[idx] = JSON.parse(JSON.stringify(user));
                        }
                        return copy;
                    } catch {
                        return prev;
                    }
                });

                // Bloquear edición de permisos para este usuario después de guardar
                setPermissionsEditable(prev => ({ ...prev, [key]: false }));
            } else {
                // Crear nuevo usuario (actor-aware)
                const permissionsToCreate = { ...(user.permissions || {}) } as Record<string, unknown>;
                await UsersService.createUserAs(currentUser, {
                    name: user.name,
                    password: user.password,
                    role: user.role,
                    isActive: user.isActive,
                    permissions: permissionsToCreate as any,
                    maxCompanies: user.maxCompanies,
                    email: user.email,
                    fullName: user.fullName,
                    eliminate: user.eliminate ?? false,
                    ownerId: user.ownerId,
                    ownercompanie: user.ownercompanie
                });
                // Recargar datos para obtener el ID generado
                await loadData();
                // Después de recargar datos, asegurar que el control de edición de permisos está bloqueado
                setPermissionsEditable(prev => ({ ...prev, [key]: false }));
            }
            showNotification(`Usuario ${user.name} guardado exitosamente`, 'success');
            // Clear global changes flag so UI removes "Cambios pendientes" badges
            setHasChanges(false);
        } catch (error) {
            showNotification('Error al guardar el usuario', 'error');
            console.error('Error saving user:', error);
        } finally {
            setSavingUserKey(null);
        }
    };

    // (locations individual save removed with locations tab)

    // Funciones para manejar configuración CCSS
    const updateCcssConfig = (field: 'mt' | 'tc' | 'valorhora' | 'horabruta', value: number) => {
        setCcssData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-2 sm:p-4 md:p-6">            {/* Loading Modal */}
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


            {/* File Tabs */}
            <div className="mb-6 overflow-x-auto">
                <div className="border-b border-[var(--input-border)]">
                    <nav className="-mb-px flex flex-nowrap space-x-2 sm:space-x-4 md:space-x-8">
                        <button
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
                            onClick={() => setActiveFile('sorteos')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'sorteos'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            Sorteos ({sorteosData.length})
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
                        <button
                            onClick={() => setActiveFile('empresas')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeFile === 'empresas'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] hover:border-[var(--border)]'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Empresas ({empresasData.length})
                        </button>
                        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">

                            <button
                                onClick={openExportModal}
                                className="px-3 py-2 sm:px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-colors text-sm sm:text-base"
                            >
                                <Download className="w-4 h-4" />
                                Exportar
                            </button>
                        </div>
                    </nav>

                </div>

            </div>

            {/* Content */}


            {activeFile === 'empresas' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
                        <h4 className="text-base sm:text-lg font-semibold">Configuración de Empresas</h4>
                        <button
                            onClick={() => setEmpresasData(prev => [...prev, { ownerId: currentUser && currentUser.eliminate === false ? currentUser.id : '', name: '', ubicacion: '', empleados: [{ Empleado: '', hoursPerShift: 8, extraAmount: 0, ccssType: 'TC' }] }])}
                            className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
                        >
                            Agregar Empresa
                        </button>
                    </div>

                    {empresasData.map((empresa, idx) => (
                        <div key={empresa.id || idx} className="border border-[var(--input-border)] rounded-lg p-2 sm:p-4 relative">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Nombre de la empresa:</label>
                                    <input
                                        type="text"
                                        value={empresa.name || ''}
                                        onChange={(e) => {
                                            const copy = [...empresasData];
                                            copy[idx] = { ...copy[idx], name: e.target.value };
                                            setEmpresasData(copy);
                                        }}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Ubicación:</label>
                                    <input
                                        type="text"
                                        value={empresa.ubicacion || ''}
                                        onChange={(e) => {
                                            const copy = [...empresasData];
                                            copy[idx] = { ...copy[idx], ubicacion: e.target.value };
                                            setEmpresasData(copy);
                                        }}
                                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium">Empleados:</label>
                                    <button
                                        onClick={() => {
                                            const copy = [...empresasData];
                                            if (!copy[idx].empleados) copy[idx].empleados = [];
                                            copy[idx].empleados.push({ Empleado: '', 'Horas por turno': 8, 'Monto extra': 0, 'ccssType ': '' });
                                            setEmpresasData(copy);
                                        }}
                                        className="text-sm bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                    >
                                        Agregar Empleado
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {empresa.empleados?.map((emp: any, eIdx: number) => (
                                        <div key={eIdx} className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center p-2 sm:p-3 border border-[var(--input-border)] rounded-md">
                                            <div className="col-span-2 sm:flex-1 min-w-[120px]">
                                                <label className="block text-xs mb-1">Empleado</label>
                                                <input
                                                    type="text"
                                                    value={emp.Empleado}
                                                    onChange={(ev) => {
                                                        const copy = [...empresasData];
                                                        copy[idx].empleados[eIdx].Empleado = ev.target.value;
                                                        setEmpresasData(copy);
                                                    }}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                />
                                            </div>
                                            <div className="col-span-1 sm:w-32">
                                                <label className="block text-xs mb-1">Horas por turno</label>
                                                <input
                                                    type="number"
                                                    value={emp.hoursPerShift ?? 8}
                                                    onChange={(ev) => {
                                                        const copy = [...empresasData];
                                                        copy[idx].empleados[eIdx].hoursPerShift = parseInt(ev.target.value) || 0;
                                                        setEmpresasData(copy);
                                                    }}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md text-sm"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                />
                                            </div>
                                            <div className="col-span-1 sm:w-32">
                                                <label className="block text-xs mb-1">Monto extra</label>
                                                <input
                                                    type="number"
                                                    value={emp.extraAmount ?? 0}
                                                    onChange={(ev) => {
                                                        const copy = [...empresasData];
                                                        copy[idx].empleados[eIdx].extraAmount = parseFloat(ev.target.value) || 0;
                                                        setEmpresasData(copy);
                                                    }}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md text-sm"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                />
                                            </div>
                                            <div className="col-span-1 sm:w-40">
                                                <label className="block text-xs mb-1">Tipo CCSS</label>
                                                <select
                                                    value={emp.ccssType || 'TC'}
                                                    onChange={(ev) => {
                                                        const copy = [...empresasData];
                                                        copy[idx].empleados[eIdx].ccssType = ev.target.value;
                                                        setEmpresasData(copy);
                                                    }}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md text-sm"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                >
                                                    <option value="TC">Tiempo Completo</option>
                                                    <option value="MT">Medio Tiempo</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 sm:w-10 flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        openConfirmModal(
                                                            'Eliminar Empleado',
                                                            `¿Desea eliminar al empleado ${emp.Empleado || eIdx + 1}?`,
                                                            () => {
                                                                const copy = [...empresasData];
                                                                copy[idx].empleados = copy[idx].empleados.filter((_: unknown, i: number) => i !== eIdx);
                                                                setEmpresasData(copy);
                                                            }
                                                        );
                                                    }}
                                                    className="px-2 sm:px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                                >
                                                    X
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                                <button
                                    onClick={async () => {
                                        // Save single empresa
                                        try {
                                            const e = empresasData[idx];
                                            if (e.id) {
                                                await EmpresasService.updateEmpresa(e.id, e);
                                                showNotification('Empresa actualizada', 'success');
                                            } else {
                                                const ownerIdToUse = resolveOwnerIdForActor(e.ownerId);
                                                const idToUse = e.name && e.name.trim() !== '' ? e.name.trim() : undefined;
                                                if (!idToUse) {
                                                    showNotification('El nombre (name) es requerido para crear la empresa con id igual a name', 'error');
                                                } else {
                                                    try {
                                                        await EmpresasService.addEmpresa({ id: idToUse, ownerId: ownerIdToUse, name: e.name || '', ubicacion: e.ubicacion || '', empleados: e.empleados || [] });
                                                        await loadData();
                                                        showNotification('Empresa creada', 'success');
                                                    } catch (err) {
                                                        const message = err && (err as Error).message ? (err as Error).message : 'Error al guardar empresa';
                                                        // If it's owner limit, show modal with explanation; otherwise fallback to notification
                                                        if (message.includes('maximum allowed companies') || message.toLowerCase().includes('max')) {
                                                            openConfirmModal('Límite de empresas', message, () => { /* sólo cerrar */ }, { singleButton: true, singleButtonText: 'Cerrar' });
                                                        } else {
                                                            showNotification('Error al guardar empresa', 'error');
                                                        }
                                                    }
                                                }
                                            }
                                        } catch (err) {
                                            console.error('Error saving empresa:', err);
                                            showNotification('Error al guardar empresa', 'error');
                                        }
                                    }}
                                    className="px-3 py-2 sm:px-4 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors text-sm sm:text-base"
                                >
                                    Guardar Empresa
                                </button>
                                <button
                                    onClick={() => openConfirmModal('Eliminar Empresa', '¿Desea eliminar esta empresa?', async () => {
                                        try {
                                            const e = empresasData[idx];
                                            if (e.id) await EmpresasService.deleteEmpresa(e.id);
                                            setEmpresasData(prev => prev.filter((_, i) => i !== idx));
                                            showNotification('Empresa eliminada', 'success');
                                        } catch (err) {
                                            console.error('Error deleting empresa:', err);
                                            showNotification('Error al eliminar empresa', 'error');
                                        }
                                    })}
                                    className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base"
                                >
                                    Eliminar Empresa
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeFile === 'sorteos' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
                        <h4 className="text-base sm:text-lg font-semibold">Configuración de Sorteos</h4>
                        <button
                            onClick={addSorteo}
                            className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
                        >
                            Agregar Sorteo
                        </button>
                    </div>

                    {sorteosData.map((sorteo, index) => (
                        <div key={sorteo.id || index} className="border border-[var(--input-border)] rounded-lg p-2 sm:p-4">
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
                                <div className="flex-1 w-full">
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
                                    className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base w-full sm:w-auto mt-2 sm:mt-0"
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
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
                        <div>
                            <h4 className="text-base sm:text-lg font-semibold">Configuración de Usuarios</h4>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                Gestiona usuarios, roles y permisos del sistema
                            </p>
                        </div>
                        <button
                            onClick={addUser}
                            className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
                        >
                            Agregar Usuario
                        </button>
                    </div>

                    {usersData.map((user, index) => (
                        <div key={user.id || index} className="border border-[var(--input-border)] rounded-lg p-2 sm:p-4 relative">
                            {hasUserChanged(index) && (
                                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                    Cambios pendientes
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                                    {/* Mostrar nombre de la empresa dueña si existe (ownercompanie) */}
                                    {user.ownercompanie && (
                                        <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                                            Empresa Dueña: <span className="font-medium text-[var(--foreground)]">{user.ownercompanie}</span>
                                        </div>
                                    )}
                                </div>
                                {/* Ubicación removed visually as requested */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Empresa Dueña:</label>
                                    {/* Only show empresas whose ownerId matches the user's ownerId (or resolved owner) */}
                                    {(() => {
                                        // resolvedOwnerId must not change: use user.ownerId (the tenant) or fallback to currentUser owner
                                        const resolvedOwnerId = user.ownerId || (currentUser?.ownerId ?? (currentUser && currentUser.eliminate === false ? currentUser.id : '')) || '';
                                        const allowedEmpresas = empresasData.filter(e => (e?.ownerId || '') === resolvedOwnerId);
                                        return (
                                            <>
                                                <select
                                                    value={user.ownercompanie || ''}
                                                    onChange={(e) => updateUser(index, 'ownercompanie', e.target.value)}
                                                    className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                                    style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                                >
                                                    <option value="">Seleccionar empresa</option>
                                                    {allowedEmpresas.map((empresa) => (
                                                        <option key={empresa.id || empresa.name} value={empresa.name}>
                                                            {empresa.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {allowedEmpresas.length === 0 && (
                                                    <p className="text-xs mt-1 text-yellow-600">No hay empresas disponibles para el owner asignado.</p>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Email y Nombre Completo — mostrar sólo si el usuario logueado es superadmin y el rol seleccionado es admin/superadmin */}
                            {currentUser?.role === 'superadmin' && (user.role === 'admin' || user.role === 'superadmin') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Correo electrónico:</label>
                                        <input
                                            type="email"
                                            value={user.email || ''}
                                            onChange={(e) => updateUser(index, 'email', e.target.value)}
                                            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Nombre completo:</label>
                                        <input
                                            type="text"
                                            value={user.fullName || ''}
                                            onChange={(e) => updateUser(index, 'fullName', e.target.value)}
                                            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                            placeholder="Nombre completo de la persona encargada"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Contraseña:</label>
                                    <div className="relative">
                                        <input
                                            type={passwordVisibility[getUserKey(user, index)] ? 'text' : 'password'}
                                            value={user.password || ''}
                                            onChange={(e) => updateUser(index, 'password', e.target.value)}
                                            className="w-full px-3 py-2 pr-10 border border-[var(--input-border)] rounded-md"
                                            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                            placeholder="Contraseña del usuario"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility(user, index)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                            title={passwordVisibility[getUserKey(user, index)] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        >
                                            {passwordVisibility[getUserKey(user, index)] ? (
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
                                        {/* If currentUser is superadmin and this is a newly created local user (no id), do not show 'user' option */}
                                        {!(currentUser?.role === 'superadmin' && !user.id) && (
                                            <option value="user">Usuario</option>
                                        )}
                                        <option value="admin">Administrador</option>
                                        {currentUser?.role === 'superadmin' && (
                                            <option value="superadmin">Super Administrador</option>
                                        )}
                                    </select>
                                </div>
                                {/* If role is admin, show maxCompanies field */}
                                {user.role === 'admin' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Máx. Empresas:</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={user.maxCompanies ?? ''}
                                            onChange={(e) => updateUser(index, 'maxCompanies', e.target.value === '' ? undefined : Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                                            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                            placeholder="Cantidad máxima de empresas"
                                        />
                                    </div>
                                )}
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

                            {/* Sección de Permisos */}
                            <div className="mb-4 p-2 sm:p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    <h5 className="font-medium" style={{ color: 'var(--foreground)' }}>Permisos del Usuario</h5>
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                        Rol: {user.role || 'user'}
                                    </span>
                                </div>
                                {renderUserPermissions(user, index)}
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        <strong>Nota:</strong> Marca &quot;Editar Permisos&quot; para habilitar los checkboxes, realiza los cambios y luego presiona &quot;Guardar&quot; para aplicar los permisos al usuario.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                                <button
                                    onClick={() => saveIndividualUser(index)}
                                    className="px-3 py-2 sm:px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
                                    disabled={savingUserKey === getUserKey(user, index)}
                                >
                                    <Save className="w-4 h-4" />
                                    {savingUserKey === getUserKey(user, index) ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                    onClick={() => removeUser(index)}
                                    className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base"
                                    disabled={savingUserKey === getUserKey(user, index) || (currentUser?.role === 'admin' && (user.eliminate === false || user.eliminate === undefined))}
                                    title={currentUser?.role === 'admin' && (user.eliminate === false || user.eliminate === undefined) ? 'No puedes eliminar este usuario: marcado como protegido' : 'Eliminar Usuario'}
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
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
                        <div>
                            <h4 className="text-base sm:text-xl font-semibold flex items-center gap-2">
                                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                                Configuración de Pago CCSS
                            </h4>
                            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1">
                                Configurar los montos de pago a la Caja Costarricense de Seguro Social (CCSS)
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                        {/* Tiempo Completo */}
                        <div className="border border-[var(--input-border)] rounded-lg p-3 sm:p-6">
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
                        <div className="border border-[var(--input-border)] rounded-lg p-3 sm:p-6">
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

                        {/* Valor por Hora */}
                        <div className="border border-[var(--input-border)] rounded-lg p-3 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h5 className="font-semibold text-lg">Valor por Hora</h5>
                                    <p className="text-sm text-[var(--muted-foreground)]">Tarifa horaria predeterminada</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium">Monto por Hora:</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)]">₡</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={ccssData.valorhora || 1441}
                                        onChange={(e) => updateCcssConfig('valorhora', parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-3 border border-[var(--input-border)] rounded-md text-lg font-semibold"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="1441"
                                    />
                                </div>
                                <p className="text-xs text-[var(--muted-foreground)]">
                                    Valor por defecto: ₡1,441.00
                                </p>
                            </div>
                        </div>

                        {/* Hora Bruta */}
                        <div className="border border-[var(--input-border)] rounded-lg p-3 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h5 className="font-semibold text-lg">Hora Bruta</h5>
                                    <p className="text-sm text-[var(--muted-foreground)]">Tarifa horaria bruta</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium">Monto Hora Bruta:</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)]">₡</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={ccssData.horabruta || 1529.62}
                                        onChange={(e) => updateCcssConfig('horabruta', parseFloat(e.target.value) || 0)}
                                        className="w-full pl-8 pr-3 py-3 border border-[var(--input-border)] rounded-md text-lg font-semibold"
                                        style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                                        placeholder="1529.62"
                                    />
                                </div>
                                <p className="text-xs text-[var(--muted-foreground)]">
                                    Valor por defecto: ₡1,529.62
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Resumen de configuración */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 sm:p-6">
                        <h5 className="font-semibold mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Resumen de Configuración
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-foreground)]">Tiempo Completo (TC):</span>
                                <span className="font-medium">₡{ccssData.tc.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-foreground)]">Medio Tiempo (MT):</span>
                                <span className="font-medium">₡{ccssData.mt.toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-foreground)]">Valor por Hora:</span>
                                <span className="font-medium">₡{(ccssData.valorhora || 1441).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--muted-foreground)]">Hora Bruta:</span>
                                <span className="font-medium">₡{(ccssData.horabruta || 1529.62).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</span>
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
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-2">
                        <button
                            onClick={() => {
                                if (confirm('¿Estás seguro de que quieres restaurar los valores por defecto?')) {
                                    updateCcssConfig('tc', 11017.39);
                                    updateCcssConfig('mt', 3672.46);
                                    updateCcssConfig('valorhora', 1441);
                                    updateCcssConfig('horabruta', 1529.62);
                                }
                            }}
                            className="px-3 py-2 sm:px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors text-sm sm:text-base w-full sm:w-auto"
                        >
                            Restaurar Valores Por Defecto
                        </button>

                        <button
                            onClick={saveData}
                            disabled={!hasChanges || isSaving}
                            className={`px-3 py-2 sm:px-6 rounded-md flex items-center gap-2 transition-colors text-sm sm:text-base w-full sm:w-auto ${hasChanges && !isSaving
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

            <ExportModal open={showExportModal} onClose={closeExportModal} />

            {/* Modal de confirmación */}
            <ConfirmModal
                open={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="Eliminar"
                cancelText="Cancelar"
                singleButton={confirmModal.singleButton}
                singleButtonText={confirmModal.singleButtonText}
                loading={confirmModal.loading}
                onConfirm={handleConfirm}
                onCancel={closeConfirmModal}
                actionType="delete"
            />
        </div>
    );
}
