"use client";

import { useRef } from "react";
import {
  Building2,
  FileSpreadsheet,
  ListChecks,
  PackageCheck,
  ScanLine,
  Trash2,
} from "lucide-react";
import type { Empresa } from "./verificarInventarioDb";

type VerificarInventarioHeaderProps = {
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  inventoryMode: boolean;
  listProductsMode: boolean;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onToggleInventoryMode: () => void;
  onToggleListProductsMode: () => void;
  onSelectEmpresa: (empresaId: string) => void;
  onOpenDeleteModal: () => void;
  onUploadXlsx: (file: File) => void;
  disableUpload: boolean;
  disableScanner: boolean;
  hideManagementControls: boolean;
};

export default function VerificarInventarioHeader({
  empresas,
  selectedEmpresaId,
  inventoryMode,
  listProductsMode,
  onOpenAddModal,
  onOpenScanner,
  onToggleInventoryMode,
  onToggleListProductsMode,
  onSelectEmpresa,
  onOpenDeleteModal,
  onUploadXlsx,
  disableUpload,
  disableScanner,
  hideManagementControls,
}: VerificarInventarioHeaderProps) {
  const hasSelectedEmpresa = Boolean(selectedEmpresaId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeMode = listProductsMode ? "list" : inventoryMode ? "inventory" : "verify";
  const canUseModes = hasSelectedEmpresa;
  const modeButtonClass = (active: boolean) =>
    `inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
      active
        ? "border-blue-500 bg-blue-600 text-white shadow-sm"
        : "border-[var(--input-border)] text-[var(--foreground)] hover:border-blue-400 hover:bg-blue-500/10"
    } disabled:cursor-not-allowed disabled:opacity-50`;

  return (
    <header className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
          <h1 className="text-lg font-bold text-[var(--foreground)]">
            Verificar Inventario
          </h1>
          <p className="text-sm text-[var(--foreground)] opacity-80">
            Selecciona empresa, carga XLSX, escanea y revisa resultados.
          </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
          {!hideManagementControls ? (
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Building2 className="h-4 w-4" />
              Agregar empresa
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenScanner}
            disabled={disableScanner}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            title={disableScanner ? "Selecciona una empresa antes de escanear." : "Abrir escáner"}
          >
            <ScanLine className="h-4 w-4" />
            Abrir escáner
          </button>

          {!hideManagementControls ? (
            <>
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
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                title={disableUpload ? "Selecciona una empresa antes de cargar el XLSX." : "Cargar archivo XLSX"}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Cargar .xlsx
              </button>
            </>
          ) : null}

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

          {hasSelectedEmpresa && !hideManagementControls ? (
            <button
              type="button"
              onClick={onOpenDeleteModal}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar empresa
            </button>
          ) : null}
          </div>
        </div>

        <div className="grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-4">
          {["1. Empresa", "2. XLSX", "3. Escanear", "4. Revisar"].map((step) => (
            <div
              key={step}
              className="rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 font-semibold"
            >
              {step}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {activeMode !== "verify" ? (
            <button
              type="button"
              onClick={() => {
                if (inventoryMode) onToggleInventoryMode();
                if (listProductsMode) onToggleListProductsMode();
              }}
              className={modeButtonClass(false)}
            >
              <ScanLine className="h-4 w-4" />
              Verificar
            </button>
          ) : (
            <div className={modeButtonClass(true)}>
              <ScanLine className="h-4 w-4" />
              Verificar
            </div>
          )}
          <button
            type="button"
            onClick={onToggleInventoryMode}
            disabled={!canUseModes}
            className={modeButtonClass(activeMode === "inventory")}
          >
            <PackageCheck className="h-4 w-4" />
            Inventariar
          </button>
          <button
            type="button"
            onClick={onToggleListProductsMode}
            disabled={!canUseModes}
            className={modeButtonClass(activeMode === "list")}
          >
            <ListChecks className="h-4 w-4" />
            Listar productos
          </button>
          {!hasSelectedEmpresa ? (
            <span className="text-xs text-amber-600">
              Selecciona una empresa para activar modos y carga.
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
