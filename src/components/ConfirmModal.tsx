import React from 'react';
import { CheckCircle2, Trash2, AlertTriangle, XCircle } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  actionType?: 'assign' | 'delete' | 'change';
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
  actionType = 'assign',
}) => {
  if (!open) return null;

  let icon = <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
  let confirmIcon = <CheckCircle2 className="h-4 w-4" />;
  const cancelIcon = <XCircle className="h-4 w-4" />;
  if (actionType === 'delete') {
    icon = <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />;
    confirmIcon = <Trash2 className="h-4 w-4" />;
  }
  if (actionType === 'change') {
    icon = <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-300" />;
    confirmIcon = <AlertTriangle className="h-4 w-4" />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70">
      <div className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-lg p-6 w-full max-w-sm border border-[var(--input-border)]">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <div className="mb-4 text-base">{message}</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            className="px-4 py-2 rounded bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={onCancel}
            disabled={loading}
            type="button"
          >
            {cancelIcon}
            {cancelText}
          </button>
          <button
            className={`px-4 py-2 rounded text-white flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${actionType === 'delete' ? 'bg-red-600 hover:bg-red-700' : actionType === 'change' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4 mr-1 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              confirmIcon
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
