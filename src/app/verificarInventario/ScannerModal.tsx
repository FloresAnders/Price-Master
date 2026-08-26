"use client";

import { useEffect } from "react";
import CameraScanner from "./CameraScanner";
import PendingCodeOverlay from "./PendingCodeOverlay";
import ScanNoticeOverlay from "./ScanNoticeOverlay";

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
    variant: "found" | "added" | "duplicate";
    codigo: string;
    codigoProducto?: string;
    codigoBarras?: string;
    descripcion: string;
    precioVenta?: string;
  } | null;
  inventoryMode: boolean;
  listProductsMode: boolean;
  inventoryCount: string;
  inventoryError: string | null;
  onInventoryCountChange: (value: string) => void;
  onInventorySave: () => void;
  onInventoryCancel: () => void;
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
  inventoryMode,
  listProductsMode,
  inventoryCount,
  inventoryError,
  onInventoryCountChange,
  onInventorySave,
  onInventoryCancel,
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
    if (!open && !manualAddOpen && !pendingCodigo) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      if (manualAddOpen) {
        onManualPendingClose();
        return;
      }

      if (open) {
        onClose();
        return;
      }

      if (pendingCodigo) {
        onPendingCancel();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    manualAddOpen,
    onClose,
    onManualPendingClose,
    onPendingCancel,
    open,
    pendingCodigo,
  ]);

  if (!open && !manualAddOpen && !pendingCodigo) return null;

  const scannerOverlay = open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--input-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Abrir escáner
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
              {listProductsMode ? "Agregar código a la lista" : "Buscar código manualmente"}
            </label>
            <p className="mt-1 text-xs opacity-70">
              {listProductsMode
                ? "Escribe el código de barras y presiona Agregar."
                : "Escribe el código de barras y presiona Buscar."}
            </p>
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
                placeholder="Código de barras"
              />
              <button
                type="button"
                onClick={onManualSearch}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {listProductsMode ? "Agregar" : "Buscar"}
              </button>
            </div>
            {manualSearchError ? (
              <p className="mt-2 text-sm text-red-500">{manualSearchError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <ScanNoticeOverlay scanNotice={scanNotice}>
        {inventoryMode && scanNotice?.variant === "found" ? (
          <div className="mt-5">
            <label className="block text-sm font-medium text-slate-100">
              Cantidad en inventario
            </label>
            <input
              value={inventoryCount}
              onChange={(event) => onInventoryCountChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onInventorySave();
                }
              }}
              className="mt-2 w-full rounded-md border border-emerald-400/30 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
              inputMode="decimal"
              autoFocus
            />
            {inventoryError ? (
              <p className="mt-2 text-sm text-red-300">{inventoryError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onInventoryCancel}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onInventorySave}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Guardar
              </button>
            </div>
          </div>
        ) : null}
      </ScanNoticeOverlay>

      <PendingCodeOverlay
        codigo={pendingCodigo}
        nombre={pendingNombre}
        error={pendingError}
        onNombreChange={onPendingNombreChange}
        onCancel={onPendingCancel}
        onSave={onPendingSave}
      />
    </div>
  ) : null;

  return (
    <>
      {scannerOverlay}

      {!open ? (
        <PendingCodeOverlay
          codigo={pendingCodigo}
          nombre={pendingNombre}
          error={pendingError}
          onNombreChange={onPendingNombreChange}
          onCancel={onPendingCancel}
          onSave={onPendingSave}
        />
      ) : null}

      {manualAddOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Agregar código manualmente
            </h3>
            <p className="mt-2 text-sm opacity-70">
              Completa el código de barras y el nombre para guardarlo como pendiente.
            </p>

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
              placeholder="Código de barras"
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
              placeholder="Nombre para identificar el producto"
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
