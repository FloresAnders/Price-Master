"use client";

import React from 'react';
import { ProviderSection } from '../components/Sections';

export default function AgregarProveedorPage() {
    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <ProviderSection />
                <div className="mt-6">
                    <a href="/fondogeneral" className="text-[var(--muted-foreground)] underline">Volver al Fondo General</a>
                </div>
            </div>
        </div>
    );
}
