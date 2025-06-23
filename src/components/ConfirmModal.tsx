import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title = 'Confirmar acción',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70">
      <div className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-lg p-6 w-full max-w-sm border border-[var(--input-border)]">
        {title && <h2 className="text-lg font-bold mb-2">{title}</h2>}
        <div className="mb-4 text-base">{message}</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-4 py-2 rounded bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onCancel}
            disabled={loading}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4 mr-1 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
