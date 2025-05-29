'use client';

interface ClearHistoryButtonProps {
    onClear: () => void;
}

export default function ClearHistoryButton({ onClear }: ClearHistoryButtonProps) {
    return (
        <div className="mt-6 flex justify-center">
            <button
                onClick={onClear}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            >
                Limpiar Historial
            </button>
        </div>
    );
}
