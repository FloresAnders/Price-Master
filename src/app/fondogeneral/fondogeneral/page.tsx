"use client";

import React, { useState } from 'react';
import { FondoSection } from '../components/Sections';

const tabs = [
    { id: 'fondo', label: 'Fondo General' },
    { id: 'bcr', label: 'Cuenta BCR' },
    { id: 'bn', label: 'Cuenta BN' },
    { id: 'bac', label: 'Cuenta BAC' },
];

export default function FondoPage() {
    const [active, setActive] = useState<string>('fondo');

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 border ">TODO: ELIMINAR ESTE DIV
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div>
                    <div role="tablist" aria-label="Cuentas" className="flex gap-4 border-b border-[var(--input-border)] mb-4">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={active === tab.id}
                                onClick={() => setActive(tab.id)}
                                className={`py-2 px-4 -mb-px focus:outline-none ${active === tab.id
                                    ? 'border-b-2 border-[var(--accent)] font-semibold'
                                    : 'text-[var(--muted)]'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="mt-4">
                        {active === 'fondo' && (<><FondoSection /> </>)}

                        {active === 'bcr' && (
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Cuenta BCR</h3>
                                <div>
                                    <a
                                        href="/fondogeneral"
                                        className="text-sm text-[var(--muted-foreground)] sm:justify-self-start flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                            <path d="M19 12H5" />
                                            <path d="M12 19l-7-7 7-7" />
                                        </svg>
                                        <span>Volver</span>
                                    </a>
                                </div>
                            </div>
                        )}

                        {active === 'bn' && (
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Cuenta BN</h3>
                                <div>
                                    <a
                                        href="/fondogeneral"
                                        className="text-sm text-[var(--muted-foreground)] sm:justify-self-start flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                            <path d="M19 12H5" />
                                            <path d="M12 19l-7-7 7-7" />
                                        </svg>
                                        <span>Volver</span>
                                    </a>
                                </div>
                            </div>
                        )}

                        {active === 'bac' && (
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Cuenta BAC</h3>
                                <div>
                                    <a
                                        href="/fondogeneral"
                                        className="text-sm text-[var(--muted-foreground)] sm:justify-self-start flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                            <path d="M19 12H5" />
                                            <path d="M12 19l-7-7 7-7" />
                                        </svg>
                                        <span>Volver</span>
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
