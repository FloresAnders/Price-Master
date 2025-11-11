"use client";

import React from 'react';
import Link from 'next/link';
import { ProviderSection } from '../components/Sections';

export default function AgregarProveedorPage() {
    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <ProviderSection />
                <div className="mt-6">
                    <Link href="/fondogeneral" className="text-sm text-[var(--muted-foreground)] sm:justify-self-start flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                            <path d="M19 12H5" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        <span>Volver</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
