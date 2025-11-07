"use client";

import React from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';

export default function OtraPage() {
    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div className="flex items-center mb-4">
                    <Layers className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Otra</h1>
                </div>

                <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
                    <p className="text-[var(--muted-foreground)]">Acciones adicionales próximamente.</p>
                </div>

                <div className="mt-6">
                    <Link href="/fondogeneral" className="text-[var(--muted-foreground)] underline">Volver al Fondo General</Link>
                </div>
            </div>
        </div>
    );
}
