'use client'

import { Eye, EyeOff, Info, Loader2, User as UserIcon, X, Check, Camera } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import useToast from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { UsersService } from '../../services/users';
import type { User as UserRecord } from '../../types/firestore';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const { showToast } = useToast();
    // Close on ESC
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);
    const { user } = useAuth();

    const [profile, setProfile] = useState<UserRecord | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        fullName: '',
        email: '',
        password: '',
        passwordConfirm: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ownerInfo, setOwnerInfo] = useState<UserRecord | null>(null);
    const [ownerLoading, setOwnerLoading] = useState(false);

    const baseUser = profile ?? user ?? null;

    const loadProfile = useCallback(async () => {
        if (!user?.id) {
            setProfile(null);
            setFormData({
                name: '',
                fullName: '',
                email: '',
                password: '',
                passwordConfirm: ''
            });
            setProfileError('No se encontró el usuario en la sesión actual.');
            return;
        }

        setProfileLoading(true);
        setProfileError(null);

        try {
            const record = await UsersService.getUserById(user.id);
            const source = record ?? user;

            setProfile(record ?? null);
            setFormData({
                name: source?.name ?? '',
                fullName: source?.fullName ?? '',
                email: source?.email ?? '',
                password: '',
                passwordConfirm: ''
            });
        } catch (err) {
            console.error('Error fetching user profile', err);
            const fallback = user ?? null;
            setProfile(null);
            setFormData({
                name: fallback?.name ?? '',
                fullName: fallback?.fullName ?? '',
                email: fallback?.email ?? '',
                password: '',
                passwordConfirm: ''
            });
            setProfileError('No se pudo cargar la información desde la base de datos.');
        } finally {
            setProfileLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!isOpen) {
            setProfile(null);
            setProfileError(null);
            setFormData({
                name: '',
                fullName: '',
                email: '',
                password: '',
                passwordConfirm: ''
            });
            return;
        }

        loadProfile();
        setError(null);
    }, [isOpen, loadProfile]);

    const ownerId = baseUser?.ownerId ?? null;

    useEffect(() => {
        if (!isOpen) return;
        if (!ownerId) {
            setOwnerInfo(null);
            setOwnerLoading(false);
            return;
        }

        let isMounted = true;
        setOwnerLoading(true);
        setOwnerInfo(null);

        UsersService.getUserById(ownerId)
            .then((owner) => {
                if (isMounted && owner) {
                    setOwnerInfo(owner);
                }
            })
            .catch((err) => {
                console.error('Error fetching owner user', err);
                if (isMounted) {
                    setOwnerInfo(null);
                }
            })
            .finally(() => {
                if (isMounted) {
                    setOwnerLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, ownerId]);

    const hasChanges = useMemo(() => {
        if (!baseUser) return false;
        const baseName = baseUser.name ?? '';
        const baseFullName = baseUser.fullName ?? '';
        const baseEmail = baseUser.email ?? '';

        return (
            formData.name !== baseName ||
            formData.fullName !== baseFullName ||
            formData.email !== baseEmail ||
            formData.password.length > 0
        );
    }, [formData, baseUser]);

    const handleChange = (field: keyof typeof formData) => (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = event.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (!formData.password && formData.passwordConfirm) {
            setFormData((prev) => ({ ...prev, passwordConfirm: '' }));
        }
    }, [formData.password, formData.passwordConfirm]);

    useEffect(() => {
        if (!formData.password) {
            setShowPasswordConfirm(false);
        }
    }, [formData.password]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) {
            setError('No hay una sesión activa.');
            return;
        }

        const targetId = baseUser?.id ?? user.id;
        if (!targetId) {
            setError('No se encontró el identificador del usuario actual.');
            return;
        }

        const trimmedName = formData.name.trim();
        const trimmedFullName = formData.fullName.trim();
        const trimmedEmail = formData.email.trim();
        const trimmedPassword = formData.password;

        if (!trimmedName) {
            setError('El nombre es obligatorio.');
            return;
        }

        if (trimmedPassword !== formData.passwordConfirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const payload: Partial<UserRecord> = {
                name: trimmedName,
                fullName: trimmedFullName || undefined,
                email: trimmedEmail || undefined
            };

            if (trimmedPassword) {
                payload.password = trimmedPassword;
            }

            await UsersService.updateUserAs(user, targetId, payload);

            try {
                if (typeof window !== 'undefined') {
                    const sessionRaw = window.localStorage.getItem('pricemaster_session');
                    if (sessionRaw) {
                        const sessionData = JSON.parse(sessionRaw);
                        sessionData.name = payload.name ?? sessionData.name;
                        if (payload.fullName !== undefined) {
                            sessionData.fullName = payload.fullName;
                        }
                        if (payload.email !== undefined) {
                            sessionData.email = payload.email;
                        }
                        window.localStorage.setItem('pricemaster_session', JSON.stringify(sessionData));
                    }
                }
            } catch (storageError) {
                console.warn('No se pudo sincronizar la sesión local', storageError);
            }

            await loadProfile();
            showToast('Perfil actualizado correctamente.', 'success');
        } catch (err) {
            console.error('Error updating profile', err);
            const message = err instanceof Error ? err.message : 'No se pudo actualizar el perfil.';
            setError(message);
            showToast(message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const isFormLocked = profileLoading || isSaving;

    const initials = useMemo(() => {
        const source = profile ?? user ?? null;
        const name = source?.fullName || source?.name || '';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'U';
        const first = parts[0]?.[0] ?? '';
        const second = parts.length > 1 ? parts[1]?.[0] ?? '' : parts[0]?.[1] ?? '';
        return (first + second).toUpperCase();
    }, [profile, user]);

    const role = baseUser?.role || 'user';
    const roleLabel = role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Administrador' : 'Usuario';
    const ownerDisplayName = ownerInfo?.fullName || ownerInfo?.name || baseUser?.ownercompanie || 'Sin asignar';
    const ownerEmail = ownerInfo?.email;
    const showOwnerInfo = Boolean(ownerId || baseUser?.ownercompanie);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--input-border)]">
                    <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-3">
                                <UserIcon className="w-5 h-5 text-[var(--primary)]" />
                            Editar Perfil
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 bg-[var(--card-bg)] rounded">
                        {!user ? (
                            <p className="text-sm text-[var(--muted-foreground)]">No se pudo cargar la información del usuario.</p>
                        ) : profileLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-24 h-24 rounded-full bg-[var(--input-bg)] border border-[var(--input-border)] flex items-center justify-center overflow-hidden">
                                        {(baseUser as any)?.photoUrl ? (
                                            // placeholder: if real photo exists, show it (rare); otherwise show initials
                                            // functionality to upload is not implemented yet
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={(baseUser as any).photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-semibold text-[var(--foreground)]">{initials}</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[var(--muted-foreground)]">Foto de perfil (próximamente funcional)</div>
                                    <div className="flex gap-2">
                                        <button disabled className="inline-flex items-center gap-2 rounded-md border border-[var(--input-border)] px-3 py-1 text-sm text-[var(--foreground)] bg-transparent opacity-60 cursor-not-allowed">
                                            <Camera className="w-4 h-4 text-[var(--muted-foreground)]" />
                                            Cambiar
                                        </button>
                                        <button disabled className="inline-flex items-center gap-2 rounded-md border border-[var(--input-border)] px-3 py-1 text-sm text-[var(--foreground)] bg-transparent opacity-60 cursor-not-allowed">
                                            Eliminar
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-[var(--foreground)]">Datos del usuario</p>
                                    <p className="text-xs text-[var(--muted-foreground)]">
                                        Rol actual: <span className="capitalize">{roleLabel}</span>
                                    </p>
                                </div>

                                {profileError && (
                                    <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700">
                                        {profileError}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <label className="flex flex-col gap-1 text-sm text-[var(--foreground)]">
                                        Nombre de usuario
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={handleChange('name')}
                                            required
                                            autoComplete="username"
                                            disabled={isFormLocked}
                                            className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1 text-sm text-[var(--foreground)]">
                                        Nombre completo
                                        <input
                                            type="text"
                                            value={formData.fullName}
                                            onChange={handleChange('fullName')}
                                            autoComplete="name"
                                            disabled={isFormLocked}
                                            className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                    </label>
                                </div>

                                <label className="flex flex-col gap-1 text-sm text-[var(--foreground)]">
                                    Correo electrónico
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange('email')}
                                        autoComplete="email"
                                        disabled={isFormLocked}
                                        className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                </label>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <label className="flex flex-col gap-1 text-sm text-[var(--foreground)]">
                                        Contraseña
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={formData.password}
                                                onChange={handleChange('password')}
                                                autoComplete="new-password"
                                                disabled={isFormLocked}
                                                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((prev) => !prev)}
                                                disabled={isFormLocked}
                                                className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        <span className="text-xs text-[var(--muted-foreground)]">Déjalo en blanco para mantener la contraseña actual.</span>
                                    </label>

                                    {formData.password.length > 0 && (
                                        <label className="flex flex-col gap-1 text-sm text-[var(--foreground)]">
                                            Confirmar contraseña
                                            <div className="relative">
                                                <input
                                                    type={showPasswordConfirm ? 'text' : 'password'}
                                                    value={formData.passwordConfirm}
                                                    onChange={handleChange('passwordConfirm')}
                                                    autoComplete="new-password"
                                                    disabled={isFormLocked}
                                                    className="w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswordConfirm((prev) => !prev)}
                                                    disabled={isFormLocked}
                                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label={showPasswordConfirm ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                                                >
                                                    {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </label>
                                    )}
                                </div>

                                {showOwnerInfo && (
                                    <div className="rounded-md border border-dashed border-[var(--input-border)] bg-[var(--card-bg)]/60 px-3 py-3 text-sm">
                                        <div className="flex items-start gap-2">
                                            <Info className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
                                            <div>
                                                <p className="font-medium text-[var(--foreground)]">Usuario Encargado</p>
                                                {ownerLoading ? (
                                                    <p className="text-[var(--muted-foreground)]">Cargando información…</p>
                                                ) : (
                                                    <>
                                                        <p className="text-[var(--muted-foreground)]">
                                                            {ownerDisplayName}
                                                            {ownerEmail ? ` · ${ownerEmail}` : ''}
                                                        </p>
                                                        {baseUser?.ownercompanie && ownerDisplayName !== baseUser.ownercompanie && (
                                                            <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                                                Empresa asignada: <span className="font-medium text-[var(--foreground)]">{baseUser.ownercompanie}</span>
                                                            </p>
                                                        )}
                                                        {baseUser?.ownercompanie && ownerDisplayName === baseUser.ownercompanie && (
                                                            <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                                                Empresa asignada vinculada a este usuario.
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                                        {error}
                                    </div>
                                )}

                                <div className="flex justify-center gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
                                    >
                                        <X className="w-4 h-4 text-[var(--muted-foreground)]" />
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!hasChanges || isSaving || profileLoading}
                                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--button-text)] transition-colors hover:bg-[var(--button-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin text-[var(--button-text)]" />
                                                Guardando…
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 text-[var(--button-text)]" />
                                                Guardar cambios
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* Click outside to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    );
}
