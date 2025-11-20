"use client";

import React from 'react';
import { Layers, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';

export default function OtraPage() {
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder a las herramientas del Fondo General.</p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div className="flex items-center mb-4">
                    <Layers className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Reportess</h1>
                </div>

                <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
                    <p className="text-[var(--muted-foreground)]">Acciones adicionales próximamente.</p>
                </div>
            </div>
        </div>
    );
}
