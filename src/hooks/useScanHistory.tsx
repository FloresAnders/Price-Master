'use client';
import { useState, useCallback } from 'react';

export function useScanHistory() {
    const [scanHistory, setScanHistory] = useState<string[]>([]);

    const handleCodeDetected = useCallback((code: string) => {
        setScanHistory(prev => {
            // Evitar duplicados consecutivos
            if (prev[0] === code) return prev;
            // Mantener solo los últimos 20 escaneos
            return [code, ...prev.slice(0, 19)];
        });
    }, []);

    const clearHistory = useCallback(() => {
        setScanHistory([]);
    }, []);

    return {
        scanHistory,
        handleCodeDetected,
        clearHistory
    };
}
