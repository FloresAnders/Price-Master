"use client";

import { useRef } from "react";
import type { Empresa } from "./verificarInventarioDb";

type VerificarInventarioHeaderProps = {
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  inventoryMode: boolean;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onToggleInventoryMode: () => void;
  onSelectEmpresa: (empresaId: string) => void;
  onOpenDeleteModal: () => void;
  onUploadXlsx: (file: File) => void;
  onExportInventario: () => void;
  disableUpload: boolean;
  disableScanner: boolean;
  disableExportInventario: boolean;
};

export default function VerificarInventarioHeader({
  empresas,
  selectedEmpresaId,
  inventoryMode,
  onOpenAddModal,
  onOpenScanner,
  onToggleInventoryMode,
  onSelectEmpresa,
  onOpenDeleteModal,
  onUploadXlsx,
  onExportInventario,
  disableUpload,
  disableScanner,
  disableExportInventario,
}: VerificarInventarioHeaderProps) {
  const hasSelectedEmpresa = Boolean(selectedEmpresaId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">
            Verificar Inventario
          </h1>
          <p className="text-sm text-[var(--foreground)] opacity-80">
            Gestiona empresas, verifica codigos y guarda inventario.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Agregar empresa
          </button>

          <button
            type="button"
            onClick={onOpenScanner}
            disabled={disableScanner}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Abrir escaner
          </button>

          <button
            type="button"
            onClick={onToggleInventoryMode}
            disabled={!hasSelectedEmpresa}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              inventoryMode
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-slate-600 hover:bg-slate-700"
            }`}
          >
            Inventariar
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onUploadXlsx(file);
              }
              event.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disableUpload}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cargar .xlsx
          </button>

          <button
            type="button"
            onClick={onExportInventario}
            disabled={disableExportInventario}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Exportar inventario
          </button>

          <select
            value={selectedEmpresaId ?? ""}
            onChange={(event) => onSelectEmpresa(event.target.value)}
            className="min-w-[220px] rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona una empresa</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nombre}
              </option>
            ))}
          </select>

          {hasSelectedEmpresa ? (
            <button
              type="button"
              onClick={onOpenDeleteModal}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Eliminar empresa
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
