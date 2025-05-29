'use client';
import { ActiveTab } from '@/types';

interface EmptyHistoryStateProps {
    onGoToScanner: () => void;
}

export default function EmptyHistoryState({ onGoToScanner }: EmptyHistoryStateProps) {
    return (
        <div className="mt-6 text-center">
            <div className="text-6xl mb-4">📱</div>
            <p className="text-gray-500 mb-4">
                Aún no has escaneado ningún código de barras
            </p>
            <button
                onClick={onGoToScanner}
                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
                Ir al Escáner
            </button>
        </div>
    );
}