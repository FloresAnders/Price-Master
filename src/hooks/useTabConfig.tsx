'use client';
import { useMemo } from 'react';
import { TabConfig, ActiveTab } from '@/types';

interface UseTabConfigProps {
    scanHistoryCount: number;
}

export function useTabConfig({ scanHistoryCount }: UseTabConfigProps): TabConfig[] {
    return useMemo(() => [
        {
            id: 'scanner' as ActiveTab,
            name: 'Escáner',
            icon: '📷',
            description: 'Escanear códigos de barras'
        },
        {
            id: 'calculator' as ActiveTab,
            name: 'Calculadora',
            icon: '🧮',
            description: 'Calcular precios con descuentos'
        },
        {
            id: 'converter' as ActiveTab,
            name: 'Conversor',
            icon: '🔤',
            description: 'Convertir y transformar texto'
        },
        {
            id: 'history' as ActiveTab,
            name: 'Historial',
            icon: '📋',
            description: 'Ver códigos escaneados',
            badge: scanHistoryCount > 0 ? scanHistoryCount : undefined
        }
    ], [scanHistoryCount]);
}
