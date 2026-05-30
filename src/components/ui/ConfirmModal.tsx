import React from "react";
import { CheckCircle2, Trash2, AlertTriangle, XCircle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  actionType?: "assign" | "delete" | "change";
  // If true, render a single button that calls onCancel. Useful for informational modals.
  singleButton?: boolean;
  singleButtonText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title = "¿Estás seguro?",
  message,
  confirmText = "Sí, confirmar",
  cancelText = "Cancelar",
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  actionType = "assign",
  singleButton = false,
  singleButtonText,
}) => {
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  let icon = <CheckCircle2 className="h-5 w-5 text-[var(--foreground)]" />;
  let confirmIcon = (
    <CheckCircle2 className="h-4 w-4 text-[var(--foreground)]" />
  );
  const cancelIcon = <XCircle className="h-4 w-4 text-[var(--foreground)]" />;
  if (actionType === "delete") {
    icon = <Trash2 className="h-5 w-5 text-[var(--foreground)]" />;
    confirmIcon = <Trash2 className="h-4 w-4 text-[var(--foreground)]" />;
  }
  if (actionType === "change") {
    icon = <AlertTriangle className="h-5 w-5 text-[var(--foreground)]" />;
    confirmIcon = (
      <AlertTriangle className="h-4 w-4 text-[var(--foreground)]" />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 dark:bg-black/80"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-xl shadow-lg p-6 w-full max-w-md border border-[var(--input-border)] flex flex-col items-stretch mx-3 relative"
        style={{ zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <span
            className={`flex items-center justify-center h-9 w-9 rounded-full shrink-0 text-white ${
              actionType === "delete"
                ? "bg-red-600"
                : actionType === "change"
                  ? "bg-yellow-500 text-black"
                  : "bg-green-600"
            }`}
          >
            {icon}
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="mt-1 text-sm text-[var(--muted-foreground)] break-words whitespace-pre-line">
              {message}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row-reverse gap-2 mt-5">
          {/** Single-button informational modal */}
          {singleButton ? (
            <button
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 justify-center w-full sm:w-auto"
              onClick={onCancel}
              disabled={loading}
              type="button"
            >
              {confirmIcon}
              {singleButtonText || "Cerrar"}
            </button>
          ) : (
            <>
              <button
                className="px-4 py-2 rounded-md border border-[var(--input-border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--input-border)]/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 justify-center w-full sm:w-auto"
                onClick={onCancel}
                disabled={loading}
                type="button"
              >
                {cancelIcon}
                {cancelText}
              </button>
              <button
                className={`px-4 py-2 rounded-md text-white flex items-center gap-2 justify-center w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed ${
                  actionType === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : actionType === "change"
                      ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                      : "bg-indigo-600 hover:bg-indigo-700"
                }`}
                onClick={onConfirm}
                disabled={loading || confirmDisabled}
                type="button"
              >
                {loading ? (
                  <svg
                    className="animate-spin h-4 w-4 mr-1 text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                ) : (
                  confirmIcon
                )}
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
