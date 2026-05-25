"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AddEmpresaModal from "./AddEmpresaModal";
import DeleteEmpresaModal from "./DeleteEmpresaModal";
import ExisteHeader from "./ExisteHeader";
import ScannerModal from "./ScannerModal";
import { useBarcodeScanner } from "./useBarcodeScanner";
import type {
  CodigoPendiente,
  ExisteState,
  RelacionProducto,
} from "./existeDb";
import { getExisteState, saveExisteState } from "./existeDb";

const EMPTY_STATE: ExisteState = {
  empresas: [],
  selectedEmpresaId: null,
  relacionesPorEmpresa: {},
  pendientesPorEmpresa: {},
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

function normalizeCode(value: string): string {
  return String(value ?? "").trim();
}

export default function ExistePage() {
  const [state, setState] = useState<ExisteState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeletePendingsOpen, setIsDeletePendingsOpen] = useState(false);
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<{
    codigo: string;
    descripcion: string;
  } | null>(null);
  const [pendingCodigo, setPendingCodigo] = useState<string | null>(null);
  const [pendingNombre, setPendingNombre] = useState("");
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const scanNoticeTimerRef = useRef<number | null>(null);

  const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-999999px";
    textarea.style.top = "-999999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const clearScanNoticeTimer = () => {
    if (scanNoticeTimerRef.current !== null) {
      window.clearTimeout(scanNoticeTimerRef.current);
      scanNoticeTimerRef.current = null;
    }
  };

  const {
    code: detectedCode,
    error: scannerError,
    cameraActive,
    liveStreamRef,
    toggleCamera,
    handleClear: clearScanner,
    handleCopyCode,
    clearDetection,
    detectionMethod,
  } = useBarcodeScanner(
    (foundCode) => {
      const empresaId = state.selectedEmpresaId;
      if (!empresaId) {
        setError("Selecciona una empresa antes de escanear.");
        clearDetection();
        return;
      }

      const codigo = normalizeCode(foundCode);
      const relacion = state.relacionesPorEmpresa[empresaId]?.find(
        (item) => normalizeCode(item.codigoBarras) === codigo,
      );

      if (relacion) {
        clearScanNoticeTimer();
        setPendingCodigo(null);
        setPendingNombre("");
        setPendingError(null);
        setScanNotice({ codigo, descripcion: relacion.descripcion });
        scanNoticeTimerRef.current = window.setTimeout(() => {
          setScanNotice(null);
          scanNoticeTimerRef.current = null;
        }, 3000);
        clearDetection();
        return;
      }

      clearScanNoticeTimer();
      setScanNotice(null);
      setPendingCodigo(codigo);
      setPendingNombre("");
      setPendingError(null);
      clearDetection();
    },
    { autoStopOnDetect: false },
  );

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
      clearScanNoticeTimer();
    };
  }, []);

  useEffect(() => {
    if (isScannerOpen && !cameraActive) {
      toggleCamera();
    }

    if (!isScannerOpen && cameraActive) {
      clearDetection();
      clearScanner();
    }
  }, [cameraActive, clearDetection, clearScanner, isScannerOpen, toggleCamera]);

  useEffect(() => {
    return () => {
      clearScanNoticeTimer();
    };
  }, []);

  const selectedEmpresa = useMemo(() => {
    if (!state.selectedEmpresaId) return null;
    return state.empresas.find((empresa) => empresa.id === state.selectedEmpresaId) ?? null;
  }, [state.empresas, state.selectedEmpresaId]);

  const selectedEmpresaPendientes = useMemo(() => {
    if (!state.selectedEmpresaId) return [];
    return state.pendientesPorEmpresa[state.selectedEmpresaId] ?? [];
  }, [state.pendientesPorEmpresa, state.selectedEmpresaId]);

  const pendingExportText = useMemo(() => {
    if (!selectedEmpresa || selectedEmpresaPendientes.length === 0) {
      return "";
    }

    const lines = [
      `Empresa: ${selectedEmpresa.nombre}`,
      `Fecha: ${new Date().toLocaleString()}`,
      "",
      "Codigo\tNombre",
      ...selectedEmpresaPendientes.map(
        (item) => `${item.codigoBarras}\t${item.nombre}`,
      ),
    ];

    return lines.join("\n");
  }, [selectedEmpresa, selectedEmpresaPendientes]);

  const openScannerModal = () => {
    if (!state.selectedEmpresaId) {
      setError("Selecciona una empresa antes de abrir el escaner.");
      return;
    }

    setError(null);
    setIsScannerOpen(true);
  };

  const closeScannerModal = () => {
    setIsScannerOpen(false);
    setPendingCodigo(null);
    setPendingNombre("");
    setPendingError(null);
    setPendingStatus(null);
    setScanNotice(null);
    clearScanNoticeTimer();
    clearDetection();
    clearScanner();
  };

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
      pendientesPorEmpresa: {
        ...state.pendientesPorEmpresa,
        [empresaId]: state.pendientesPorEmpresa[empresaId] ?? [],
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
    const nextPendientesPorEmpresa = Object.fromEntries(
      Object.entries(state.pendientesPorEmpresa).filter(
        ([empresaId]) => empresaId !== deletedEmpresaId,
      ),
    );

    const nextState: ExisteState = {
      empresas: nextEmpresas,
      selectedEmpresaId: nextEmpresas[0]?.id ?? null,
      relacionesPorEmpresa: nextRelacionesPorEmpresa,
      pendientesPorEmpresa: nextPendientesPorEmpresa,
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

  const handleSavePendingCode = async () => {
    if (!state.selectedEmpresaId || !pendingCodigo) return;

    const nombre = pendingNombre.trim();
    if (!nombre) {
      setPendingError("Ingresa un nombre para guardar el código.");
      return;
    }

    const empresaId = state.selectedEmpresaId;
    const nextPending: CodigoPendiente = {
      codigoBarras: pendingCodigo,
      nombre,
      createdAt: Date.now(),
      empresaId,
    };

    const nextPendientes = [
      nextPending,
      ...(state.pendientesPorEmpresa[empresaId] ?? []).filter(
        (item) => item.codigoBarras !== pendingCodigo,
      ),
    ];

    const nextState: ExisteState = {
      ...state,
      pendientesPorEmpresa: {
        ...state.pendientesPorEmpresa,
        [empresaId]: nextPendientes,
      },
    };

    await persistState(nextState);
    setPendingCodigo(null);
    setPendingNombre("");
    setPendingError(null);
  };

  const handleCopyPendings = async () => {
    if (!pendingExportText) return;

    try {
      await copyTextToClipboard(pendingExportText);
      setPendingStatus("Pendientes copiados al portapapeles.");
    } catch {
      setPendingStatus("No se pudieron copiar los pendientes.");
    }
  };

  const handleDeletePendings = async () => {
    if (!state.selectedEmpresaId) return;

    const empresaId = state.selectedEmpresaId;
    const nextState: ExisteState = {
      ...state,
      pendientesPorEmpresa: {
        ...state.pendientesPorEmpresa,
        [empresaId]: [],
      },
    };

    await persistState(nextState);
    setPendingStatus("Pendientes eliminados.");
    setIsDeletePendingsOpen(false);
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
        onOpenScanner={openScannerModal}
        onSelectEmpresa={handleSelectEmpresa}
        onOpenDeleteModal={() => setIsDeleteOpen(true)}
        onUploadXlsx={handleUploadXlsx}
        disableUpload={saving || !state.selectedEmpresaId}
        disableScanner={saving || !state.selectedEmpresaId}
      />

      <div className="rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-[var(--foreground)]">
        <p className="text-center">en mantenimiento</p>
        <p className="mt-2 text-center text-sm opacity-70">
          Relaciones cargadas: {selectedEmpresaRelacionesCount}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Pendientes</h2>
            <p className="text-sm opacity-70">
              Códigos sin relación cargada para {selectedEmpresa?.nombre ?? "la empresa seleccionada"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyPendings()}
              disabled={!selectedEmpresaPendientes.length}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar
            </button>
            <button
              type="button"
              onClick={() => setIsDeletePendingsOpen(true)}
              disabled={!selectedEmpresaPendientes.length}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Eliminar
            </button>
            <div className="rounded-full bg-black/5 px-3 py-1 text-sm font-semibold">
              {selectedEmpresaPendientes.length}
            </div>
          </div>
        </div>

        {selectedEmpresaPendientes.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {selectedEmpresaPendientes.map((item) => (
              <div
                key={`${item.codigoBarras}-${item.createdAt}`}
                className="rounded-md border border-[var(--input-border)] bg-[var(--background)] p-3"
              >
                <div className="text-sm font-semibold">{item.nombre}</div>
                <div className="text-xs opacity-75">{item.codigoBarras}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm opacity-70">No hay códigos pendientes.</p>
        )}
        {pendingStatus ? (
          <p className="mt-4 text-xs text-emerald-600">{pendingStatus}</p>
        ) : null}
        {lastImportCount !== null ? (
          <p className="mt-4 text-xs opacity-70">
            Última importación: {lastImportCount} relaciones.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <ScannerModal
        open={isScannerOpen}
        onClose={closeScannerModal}
        code={detectedCode}
        error={scannerError}
        detectionMethod={detectionMethod}
        cameraActive={cameraActive}
        liveStreamRef={liveStreamRef}
        toggleCamera={toggleCamera}
        handleClear={clearScanner}
        handleCopyCode={handleCopyCode}
        onRemoveLeadingZero={() => {}}
        scanNotice={scanNotice}
        pendingCodigo={pendingCodigo}
        pendingNombre={pendingNombre}
        pendingError={pendingError}
        onPendingNombreChange={(value) => {
          setPendingNombre(value);
          if (pendingError) setPendingError(null);
        }}
        onPendingCancel={() => {
          setPendingCodigo(null);
          setPendingNombre("");
          setPendingError(null);
        }}
        onPendingSave={() => {
          void handleSavePendingCode();
        }}
      />

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

      <DeleteEmpresaModal
        open={isDeletePendingsOpen}
        loading={saving}
        empresaNombre={selectedEmpresa?.nombre ?? "empresa seleccionada"}
        title="Eliminar pendientes"
        description={
          selectedEmpresaPendientes.length > 0
            ? `Vas a eliminar ${selectedEmpresaPendientes.length} pendientes de ${selectedEmpresa?.nombre ?? "la empresa seleccionada"}. Esta acción no se puede deshacer.`
            : "No hay pendientes para eliminar."
        }
        confirmLabel="Eliminar pendientes"
        onClose={() => setIsDeletePendingsOpen(false)}
        onConfirm={handleDeletePendings}
      />
    </section>
  );
}
