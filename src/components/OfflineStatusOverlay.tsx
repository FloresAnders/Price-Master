"use client";

import { useEffect, useRef, useState } from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export const INTERNET_REQUIRED_HASHES = new Set([
  "fondogeneral",
  "controlhorario",
  "empleados",
  "funciones",
  "recetas",
  "agregarproducto",
  "calculohorasprecios",
  "supplierorders",
  "reportessinpe",
  "deudasinternas",
  "scanhistory",
  "solicitud",
  "registroTucan",
  "registroTiempos",
  "anotaciones",
  "edit",
  "SupplierWeek",
]);

export default function OfflineStatusOverlay() {
  const { isOnline } = useNetworkStatus();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const homeButtonRef = useRef<HTMLButtonElement>(null);
  const [showLossModal, setShowLossModal] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setShowLossModal(false);
      if (dialogRef.current?.open) dialogRef.current.close();
      return;
    }

    const hash = window.location.hash.replace(/^#/, "");
    setShowLossModal(INTERNET_REQUIRED_HASHES.has(hash));
  }, [isOnline]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (showLossModal && !dialog.open) {
      dialog.showModal();
      homeButtonRef.current?.focus();
    } else if (!showLossModal && dialog.open) {
      dialog.close();
    }
  }, [showLossModal]);

  useEffect(() => {
    const handleHashChange = () => {
      if (isOnline) return;
      const hash = window.location.hash.replace(/^#/, "");
      setShowLossModal(INTERNET_REQUIRED_HASHES.has(hash));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isOnline]);

  const goHome = () => {
    window.location.hash = "";
    setShowLossModal(false);
  };

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-950/95 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-lg"
        >
          Trabajando sin conexión
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="offline-dialog-title"
        aria-describedby="offline-dialog-description"
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-0 text-[var(--foreground)] backdrop:bg-black/60"
      >
        <div className="p-6">
          <h2 id="offline-dialog-title" className="text-lg font-semibold">
            Conexión perdida
          </h2>
          <p id="offline-dialog-description" className="mt-2 text-sm opacity-75">
            Este módulo requiere internet. Vuelve al inicio para continuar trabajando sin conexión en módulos locales.
          </p>
          <button
            ref={homeButtonRef}
            type="button"
            onClick={goHome}
            className="mt-5 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Ir al inicio
          </button>
        </div>
      </dialog>
    </>
  );
}
