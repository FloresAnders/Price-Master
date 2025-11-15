"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, UserPlus, Layers, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';

export default function FondoGeneralIndex() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);

    const goToSection = async (subpath: string, fragment: string) => {
        try {
            // navigate to the section's individual page
            await router.push(subpath);
        } catch {
            // fallback to hub+hash
            if (typeof window !== 'undefined') window.location.href = `/fondogeneral#${fragment}`;
        }
    };

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
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div className="flex items-center mb-4">
                    <Banknote className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Fondo General</h1>
                </div>

                <p className="text-[var(--muted-foreground)] mb-4">Selecciona una acción rápida.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 justify-center">
                    <button
                        type="button"
                        onClick={() => goToSection('/fondogeneral/agregarproveedor', 'agregarproveedor')}
                        className="w-full sm:w-64 p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition flex flex-col items-center text-center"
                    >
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--muted)] mb-4">
                            <UserPlus className="w-6 h-6 text-[var(--foreground)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">Agregar proveedor</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-2">Registrar un nuevo proveedor.</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => goToSection('/fondogeneral/fondogeneral', 'fondogeneral')}
                        className="w-full sm:w-64 p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition flex flex-col items-center text-center"
                    >
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--muted)] mb-4">
                            <Banknote className="w-6 h-6 text-[var(--foreground)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">Fondo</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-2">Registrar movimientos del fondo.</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => goToSection('/fondogeneral/otra', 'otra')}
                        className="w-full sm:w-64 p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition flex flex-col items-center text-center"
                    >
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--muted)] mb-4">
                            <Layers className="w-6 h-6 text-[var(--foreground)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">Reportesdelete</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-2">Acciones adicionales.</p>
                    </button>
                </div>

                {/* Each section is its own page; hub only shows quick-action cards.
                    Clicking a card navigates to the section page then replaces the URL
                    to /fondogeneral#fragment so the address bar shows hub+hash (hybrid behavior). */}
            </div>
        </div>
    );
}
