"use client";

import React from 'react';
import { FondoSection } from '../components/Sections';

export default function FondoPage() {
    return (
    <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <FondoSection />
                <div className="mt-6">
                    <a href="/fondogeneral" className="text-[var(--muted-foreground)] underline">Volver al Fondo General</a>
                </div>
            </div>
        </div>
    );
}
