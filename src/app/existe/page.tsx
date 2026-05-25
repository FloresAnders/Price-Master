"use client";

import { useEffect, useMemo, useState } from "react";
import AddEmpresaModal from "./AddEmpresaModal";
import DeleteEmpresaModal from "./DeleteEmpresaModal";
import ExisteHeader from "./ExisteHeader";
import type { ExisteState, RelacionProducto } from "./existeDb";
import { getExisteState, saveExisteState } from "./existeDb";

const EMPTY_STATE: ExisteState = {
  empresas: [],
  selectedEmpresaId: null,
  relacionesPorEmpresa: {},
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCellText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseXlsxRowsToRelaciones(rows: unknown[][]): RelacionProducto[] {
  const headerRowIndex = rows.findIndex((row) => {
    if (!Array.isArray(row)) return false;

    const headers = row.map((cell) => normalizeHeader(cell));
    return (
      headers.includes("descripcion") &&
      headers.includes("codigo de barras")
    );
  });

  if (headerRowIndex === -1) {
    throw new Error("El archivo no contiene encabezados.");
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(cell));

  const descripcionIndex = normalizedHeaders.findIndex(
    (header) => header === "descripcion",
  );
  const codigoBarrasIndex = normalizedHeaders.findIndex(
    (header) => header === "codigo de barras",
  );

  if (descripcionIndex === -1 || codigoBarrasIndex === -1) {
    throw new Error(
      "No se encontraron las columnas requeridas: Descripción y Código de barras.",
    );
  }

  const dataRows = rows.slice(headerRowIndex + 1);

  const relaciones: RelacionProducto[] = dataRows
    .map((row) => {
      const descripcion = normalizeCellText(row?.[descripcionIndex]);
      const codigoRaw = normalizeCellText(row?.[codigoBarrasIndex]);
      const codigoBarras = codigoRaw || "NE";

      if (!descripcion && !codigoRaw) {
        return null;
      }

      if (!descripcion) {
        return null;
      }

      return {
        descripcion,
        codigoBarras,
      };
    })
    .filter((item): item is RelacionProducto => Boolean(item));

  return relaciones;
}

function createEmpresaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `empresa-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ExistePage() {
  const [state, setState] = useState<ExisteState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const savedState = await getExisteState();
        if (!cancelled) {
          setState(savedState);
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar información local.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEmpresa = useMemo(() => {
    if (!state.selectedEmpresaId) return null;
    return state.empresas.find((empresa) => empresa.id === state.selectedEmpresaId) ?? null;
  }, [state.empresas, state.selectedEmpresaId]);

  const persistState = async (nextState: ExisteState) => {
    setSaving(true);
    setError(null);
    try {
      await saveExisteState(nextState);
      setState(nextState);
    } catch {
      setError("No se pudo guardar la información en local.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmpresa = async (nombre: string) => {
    const normalizedName = nombre.trim();
    if (!normalizedName) return;

    const exists = state.empresas.some(
      (empresa) => empresa.nombre.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (exists) {
      setError("Ya existe una empresa con ese nombre.");
      return;
    }

    const empresaId = createEmpresaId();
    const nextState: ExisteState = {
      empresas: [
        ...state.empresas,
        {
          id: empresaId,
          nombre: normalizedName,
          createdAt: Date.now(),
        },
      ],
      selectedEmpresaId: empresaId,
      relacionesPorEmpresa: {
        ...state.relacionesPorEmpresa,
        [empresaId]: state.relacionesPorEmpresa[empresaId] ?? [],
      },
    };

    await persistState(nextState);
    setIsAddOpen(false);
  };

  const handleSelectEmpresa = async (empresaId: string) => {
    const nextState: ExisteState = {
      ...state,
      selectedEmpresaId: empresaId || null,
    };
    await persistState(nextState);
  };

  const handleDeleteEmpresa = async () => {
    if (!state.selectedEmpresaId) return;

    const deletedEmpresaId = state.selectedEmpresaId;

    const nextEmpresas = state.empresas.filter(
      (empresa) => empresa.id !== deletedEmpresaId,
    );

    const nextRelacionesPorEmpresa = Object.fromEntries(
      Object.entries(state.relacionesPorEmpresa).filter(
        ([empresaId]) => empresaId !== deletedEmpresaId,
      ),
    );

    const nextState: ExisteState = {
      empresas: nextEmpresas,
      selectedEmpresaId: nextEmpresas[0]?.id ?? null,
      relacionesPorEmpresa: nextRelacionesPorEmpresa,
    };

    await persistState(nextState);
    setIsDeleteOpen(false);
  };

  const handleUploadXlsx = async (file: File) => {
    if (!state.selectedEmpresaId) {
      setError("Selecciona una empresa antes de cargar un archivo.");
      return;
    }

    setSaving(true);
    setError(null);
    setLastImportCount(null);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("El archivo no contiene hojas.");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: true,
        raw: false,
      }) as unknown[][];

      const relaciones = parseXlsxRowsToRelaciones(rows);

      const nextState: ExisteState = {
        ...state,
        relacionesPorEmpresa: {
          ...state.relacionesPorEmpresa,
          [state.selectedEmpresaId]: relaciones,
        },
      };

      await saveExisteState(nextState);
      setState(nextState);
      setLastImportCount(relaciones.length);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo leer el archivo .xlsx.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedEmpresaRelacionesCount =
    state.selectedEmpresaId
      ? state.relacionesPorEmpresa[state.selectedEmpresaId]?.length ?? 0
      : 0;

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-sm text-[var(--foreground)]">
          Cargando sección...
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <ExisteHeader
        empresas={state.empresas}
        selectedEmpresaId={state.selectedEmpresaId}
        onOpenAddModal={() => setIsAddOpen(true)}
        onSelectEmpresa={handleSelectEmpresa}
        onOpenDeleteModal={() => setIsDeleteOpen(true)}
        onUploadXlsx={handleUploadXlsx}
        disableUpload={saving || !state.selectedEmpresaId}
      />

      <div className="rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-[var(--foreground)]">
        <p className="text-center">en mantenimiento</p>
        <p className="mt-3 text-sm opacity-80">
          Relaciones cargadas para la empresa seleccionada: {selectedEmpresaRelacionesCount}
        </p>
        {lastImportCount !== null ? (
          <p className="mt-1 text-sm text-emerald-500">
            Archivo procesado correctamente. Registros guardados: {lastImportCount}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <AddEmpresaModal
        open={isAddOpen}
        loading={saving}
        onClose={() => setIsAddOpen(false)}
        onConfirm={handleAddEmpresa}
      />

      <DeleteEmpresaModal
        open={isDeleteOpen}
        loading={saving}
        empresaNombre={selectedEmpresa?.nombre ?? "empresa seleccionada"}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteEmpresa}
      />
    </section>
  );
}
