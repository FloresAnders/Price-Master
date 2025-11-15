"use client";

import React, { useState } from 'react';
import { FondoSection } from '../components/fondo';

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
                        {active === 'fondo' && (<FondoSection namespace="fg" />)}

                        {active === 'bcr' && (<FondoSection namespace="bcr" />)}

                        {active === 'bn' && (<FondoSection namespace="bn" />)}

                        {active === 'bac' && (<FondoSection namespace="bac" />)}
                    </div>
                </div>
            </div>
        </div>
    );
}
