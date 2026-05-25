"use client";

import CameraScanner from "./CameraScanner";

type ScannerModalProps = {
  open: boolean;
  onClose: () => void;
  code: string | null;
  error: string | null;
  detectionMethod: string | null;
  cameraActive: boolean;
  liveStreamRef: React.RefObject<HTMLDivElement | null>;
  toggleCamera: () => void;
  handleClear: () => void;
  handleCopyCode: () => void;
  onRemoveLeadingZero?: () => void;
  scanNotice: {
    codigo: string;
    descripcion: string;
  } | null;
  pendingCodigo: string | null;
  pendingNombre: string;
  pendingError: string | null;
  onPendingNombreChange: (value: string) => void;
  onPendingCancel: () => void;
  onPendingSave: () => void;
};

export default function ScannerModal({
  open,
  onClose,
  code,
  error,
  detectionMethod,
  cameraActive,
  liveStreamRef,
  toggleCamera,
  handleClear,
  handleCopyCode,
  onRemoveLeadingZero,
  scanNotice,
  pendingCodigo,
  pendingNombre,
  pendingError,
  onPendingNombreChange,
  onPendingCancel,
  onPendingSave,
}: ScannerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--input-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Abrir escaner
            </h2>
            <p className="text-sm opacity-70">
              Escanea un código de barras para buscarlo en la empresa activa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-black/5"
          >
            Cerrar
          </button>
        </div>

        <div className="p-5">
          <CameraScanner
            code={code}
            error={error}
            detectionMethod={detectionMethod}
            cameraActive={cameraActive}
            liveStreamRef={liveStreamRef}
            toggleCamera={toggleCamera}
            handleClear={handleClear}
            handleCopyCode={handleCopyCode}
            onRemoveLeadingZero={onRemoveLeadingZero}
          />
        </div>
      </div>

      {scanNotice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-slate-950 p-6 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
              Código encontrado
            </p>
            <h3 className="mt-2 text-xl font-semibold">{scanNotice.descripcion}</h3>
            <p className="mt-3 text-sm text-slate-300">{scanNotice.codigo}</p>
          </div>
        </div>
      ) : null}

      {pendingCodigo ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Guardar en pendientes
            </h3>
            <p className="mt-2 text-sm opacity-70">{pendingCodigo}</p>

            <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">
              Nombre del producto
            </label>
            <input
              value={pendingNombre}
              onChange={(event) => onPendingNombreChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onPendingSave();
                }
              }}
              className="mt-2 w-full rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
              placeholder="Escribe el nombre para guardarlo"
            />

            {pendingError ? (
              <div className="mt-2 text-sm text-red-500">{pendingError}</div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onPendingCancel}
                className="rounded-md border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-black/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onPendingSave}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}