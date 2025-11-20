"use client";

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';
import { Lock } from 'lucide-react';

export default function FondoGeneralIndex() {
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);

    useEffect(() => {
        if (!loading && hasGeneralAccess) {
            window.location.href = '/#fondogeneral';
        }
    }, [loading, hasGeneralAccess]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder al módulo de Fondo General.</p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                <p className="text-[var(--muted-foreground)]">Redirigiendo...</p>
            </div>
        </div>
    );
}
