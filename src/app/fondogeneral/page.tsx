"use client";

import React from 'react';
import Link from 'next/link';
import { Banknote, UserPlus, Layers } from 'lucide-react';

export default function FondoGeneralIndex() {
    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div className="flex items-center mb-4">
                    <Banknote className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Fondo General</h1>
                </div>

                <p className="text-[var(--muted-foreground)] mb-4">Selecciona una acción rápida.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 justify-center">
                    <Link
                        href="/fondogeneral/agregarproveedor"
                        className="w-full sm:w-64 p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition flex flex-col items-center text-center"
                    >
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--muted)] mb-4">
                            <UserPlus className="w-6 h-6 text-[var(--foreground)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">Agregar proveedor</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-2">Registrar un nuevo proveedor.</p>
                    </Link>

                    <Link
                        href="/fondogeneral/fondogeneral"
                        className="w-full sm:w-64 p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition flex flex-col items-center text-center"
                    >
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--muted)] mb-4">
                            <Banknote className="w-6 h-6 text-[var(--foreground)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">Fondo</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-2">Registrar movimientos del fondo.</p>
                    </Link>

                    <Link
                        href="/fondogeneral/otra"
                        className="w-full sm:w-64 p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition flex flex-col items-center text-center"
                    >
                        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-[var(--muted)] mb-4">
                            <Layers className="w-6 h-6 text-[var(--foreground)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">Otra</h3>
                        <p className="text-sm text-[var(--muted-foreground)] mt-2">Acciones adicionales.</p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
