"use client";
import React from 'react';
import { ScanningService } from '../../services/scanning';
import type { ScanResult } from '../../types/firestore';

export default function ImportScans() {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!confirm('Aplicar scans desde archivo? Esto podría crear documentos.')) return;
            if (!Array.isArray(parsed)) throw new Error('Expected an array of scans');
            for (const item of parsed as unknown[]) {
                const obj = item as Record<string, unknown>;
                const payload: Omit<ScanResult, 'id' | 'timestamp'> = {
                    code: String(obj.code ?? ''),
                    source: obj.source === 'mobile' ? 'mobile' : 'web',
                    processed: Boolean(obj.processed ?? false),
                    userId: typeof obj.userId === 'string' ? obj.userId : undefined,
                    userName: typeof obj.userName === 'string' ? obj.userName : undefined,
                    sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : undefined,
                    productName: typeof obj.productName === 'string' ? obj.productName : undefined,
                    location: typeof obj.location === 'string' ? obj.location : undefined,
                    hasImages: typeof obj.hasImages === 'boolean' ? obj.hasImages : undefined
                };

                await ScanningService.addScan(payload);
            }
            alert('Scans importadas');
        } catch (err) {
            console.error(err);
            alert('Error al importar scans');
        }
    };

    return (
        <label className="btn btn-sm">
            Importar scans
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
        </label>
    );
}
