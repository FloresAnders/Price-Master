"use client";

import { useEffect } from "react";
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
  manualAddOpen: boolean;
  manualPendingCodigo: string;
  manualPendingNombre: string;
  manualPendingError: string | null;
  onManualPendingCodigoChange: (value: string) => void;
  onManualPendingNombreChange: (value: string) => void;
  onManualPendingClose: () => void;
  onManualPendingSave: () => void;
  manualSearchCodigo: string;
  manualSearchError: string | null;
  onManualSearchCodigoChange: (value: string) => void;
  onManualSearch: () => void;
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
  manualAddOpen,
  manualPendingCodigo,
  manualPendingNombre,
  manualPendingError,
  onManualPendingCodigoChange,
  onManualPendingNombreChange,
  onManualPendingClose,
  onManualPendingSave,
  manualSearchCodigo,
  manualSearchError,
  onManualSearchCodigoChange,
  onManualSearch,
}: ScannerModalProps) {
  useEffect(() => {
    if (!open && !manualAddOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      if (manualAddOpen) {
        onManualPendingClose();
        return;
      }

      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manualAddOpen, onClose, onManualPendingClose, open]);

  if (!open && !manualAddOpen) return null;

  const scannerOverlay = open ? (
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
            onStopCamera={onClose}
            handleClear={handleClear}
            handleCopyCode={handleCopyCode}
            onRemoveLeadingZero={onRemoveLeadingZero}
          />

          <div className="mt-4 rounded-2xl border border-[var(--input-border)] bg-[var(--background)] p-4">
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Buscar código manualmente
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={manualSearchCodigo}
                onChange={(event) => onManualSearchCodigoChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onManualSearch();
                  }
                }}
                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
                placeholder="Escribe o pega el código"
              />
              <button
                type="button"
                onClick={onManualSearch}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Buscar
              </button>
            </div>
            {manualSearchError ? (
              <p className="mt-2 text-sm text-red-500">{manualSearchError}</p>
            ) : null}
          </div>
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
  ) : null;

  return (
    <>
      {scannerOverlay}

      {manualAddOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Agregar código manualmente
            </h3>

            <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">
              Código de barras
            </label>
            <input
              value={manualPendingCodigo}
              onChange={(event) => onManualPendingCodigoChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onManualPendingSave();
                }
              }}
              className="mt-2 w-full rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
              placeholder="Escribe o pega el código"
            />

            <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">
              Nombre del producto
            </label>
            <input
              value={manualPendingNombre}
              onChange={(event) => onManualPendingNombreChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onManualPendingSave();
                }
              }}
              className="mt-2 w-full rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none"
              placeholder="Escribe el nombre"
            />

            {manualPendingError ? (
              <div className="mt-2 text-sm text-red-500">{manualPendingError}</div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onManualPendingClose}
                className="rounded-md border border-[var(--input-border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-black/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onManualPendingSave}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}