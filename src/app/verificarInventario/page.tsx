"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AddEmpresaModal from "./AddEmpresaModal";
import DeleteEmpresaModal from "./DeleteEmpresaModal";
import VerificarInventarioHeader from "./VerificarInventarioHeader";
import ScannerModal from "./ScannerModal";
import useToast from "@/hooks/useToast";
import { useBarcodeScanner } from "./useBarcodeScanner";
import type {
  CodigoPendiente,
  InventarioItem,
  ListadoProductoItem,
  RelacionProducto,
  VerificarInventarioState,
} from "./verificarInventarioDb";
import {
  getVerificarInventarioState,
  saveVerificarInventarioState,
} from "./verificarInventarioDb";

const PLANTILLA_HEADERS = [
  "Código",
  "Descripción",
  "Código de barras",
  "Código CABYS",
  "Actividad",
  "% IVA",
  "Unidad",
  "Precio de costo",
  "Precio de Venta",
  "Inventario",
  "Familia",
  "Proveedor",
  "Identificación proveedor",
  "Código producto proveedor",
  "Precio de Venta Crédito",
  "Precio de Venta Mayoreo",
  "Talla",
  "Marca",
  "Linea",
  "Moneda",
  "Código forma farmacéutica",
  "Registro sanitario",
];

const EMPTY_STATE: VerificarInventarioState = {
  empresas: [],
  selectedEmpresaId: null,
  relacionesPorEmpresa: {},
  pendientesPorEmpresa: {},
  inventariosPorEmpresa: {},
  listadosPorEmpresa: {},
};

const LISTAR_PRODUCTOS_STORAGE_KEY = "listar productos";

type ScanNoticeState = {
  variant: "found" | "added" | "duplicate";
  codigo: string;
  codigoProducto?: string;
  codigoBarras?: string;
  descripcion: string;
  precioVenta?: string;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s%]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCellText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePriceValue(value: unknown): string {
  const text = normalizeCellText(value);
  if (!text) return "";

  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return "";

  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) return text;

  return Number.isInteger(numberValue)
    ? String(numberValue)
    : String(numberValue).replace(/\.?0+$/, "");
}

function findHeaderIndex(headers: string[], exactAliases: string[], includesAlias = ""): number {
  const exactMatch = headers.findIndex((header) => exactAliases.includes(header));
  if (exactMatch !== -1) return exactMatch;

  if (!includesAlias) return -1;
  return headers.findIndex((header) => header.includes(includesAlias));
}

function parseXlsxRowsToRelaciones(rows: unknown[][]): RelacionProducto[] {
  const headerRowIndex = rows.findIndex((row) => {
    if (!Array.isArray(row)) return false;

    const headers = row.map((cell) => normalizeHeader(cell));
    const descripcionIndex = findHeaderIndex(
      headers,
      ["descripcion", "descripcion de producto"],
      "descripcion",
    );
    const codigoIndex = findHeaderIndex(headers, [
      "codigo",
      "codigo producto",
      "codigo de producto",
      "codigo de barras",
    ]);
    const codigoBarrasIndex = findHeaderIndex(headers, [
      "codigo de barras",
      "codigo barra",
      "codigo barras",
    ]);

    return descripcionIndex !== -1 && (codigoIndex !== -1 || codigoBarrasIndex !== -1);
  });

  if (headerRowIndex === -1) {
    throw new Error("El archivo no contiene encabezados.");
  }

  const headerRow = rows[headerRowIndex] ?? [];
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(cell));

  const descripcionIndex = findHeaderIndex(
    normalizedHeaders,
    ["descripcion", "descripcion de producto"],
    "descripcion",
  );
  const codigoIndex = findHeaderIndex(normalizedHeaders, [
    "codigo",
    "codigo producto",
    "codigo de producto",
  ]);
  const codigoBarrasIndex = findHeaderIndex(normalizedHeaders, [
    "codigo de barras",
    "codigo barra",
    "codigo barras",
  ]);
  const precioVentaIndex = findHeaderIndex(normalizedHeaders, [
    "precio de venta",
    "precio venta",
    "total precio de venta",
    "precio total",
    "precio",
    "venta",
  ]);

  if (descripcionIndex === -1 || (codigoIndex === -1 && codigoBarrasIndex === -1)) {
    throw new Error(
      "No se encontraron las columnas requeridas: Descripción y Código de barras.",
    );
  }

  const dataRows = rows.slice(headerRowIndex + 1);

  const relaciones: RelacionProducto[] = dataRows
    .map((row) => {
      const descripcion = normalizeCellText(row?.[descripcionIndex]);
      const codigo = codigoIndex === -1 ? "" : normalizeCellText(row?.[codigoIndex]);
      const codigoBarrasRaw =
        codigoBarrasIndex === -1 ? "" : normalizeCellText(row?.[codigoBarrasIndex]);
      const codigoBarras = codigoBarrasRaw || codigo || "NE";
      const precioVenta =
        precioVentaIndex === -1
          ? ""
          : normalizePriceValue(row?.[precioVentaIndex]);

      if (!descripcion && !codigo && !codigoBarrasRaw) {
        return null;
      }

      if (!descripcion) {
        return null;
      }

      return {
        ...(codigo ? { codigo } : {}),
        descripcion,
        codigoBarras,
        ...(precioVenta ? { precioVenta } : {}),
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
  const code = String(value ?? "").trim();
  return /^0\d{12}$/.test(code) ? code.slice(1) : code;
}

export default function VerificarInventarioPage() {
  const { showToast } = useToast();
  const [state, setState] = useState<VerificarInventarioState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeletePendingsOpen, setIsDeletePendingsOpen] = useState(false);
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<ScanNoticeState | null>(null);
  const [inventoryMode, setInventoryMode] = useState(false);
  const [listProductsMode, setListProductsMode] = useState(false);
  const [inventoryCount, setInventoryCount] = useState("");
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [pendingCodigo, setPendingCodigo] = useState<string | null>(null);
  const [pendingNombre, setPendingNombre] = useState("");
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [manualPendingCodigo, setManualPendingCodigo] = useState("");
  const [manualPendingNombre, setManualPendingNombre] = useState("");
  const [manualPendingError, setManualPendingError] = useState<string | null>(null);
  const [manualSearchCodigo, setManualSearchCodigo] = useState("");
  const [manualSearchError, setManualSearchError] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<string | null>(null);
  const scanNoticeTimerRef = useRef<number | null>(null);
  const stateRef = useRef<VerificarInventarioState>(EMPTY_STATE);
  const lastListedCodeRef = useRef<string | null>(null);
  const lastListedAtRef = useRef<number>(0);
  const processingListedCodesRef = useRef<Set<string>>(new Set());

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

  const findRelacionByCode = (empresaId: string, codigo: string) => {
    const normalized = normalizeCode(codigo);
    return state.relacionesPorEmpresa[empresaId]?.find((item) => {
      return (
        normalizeCode(item.codigoBarras) === normalized ||
        normalizeCode(item.codigo ?? "") === normalized
      );
    });
  };

  const showFoundCode = (codigo: string, relacion: RelacionProducto) => {
    clearScanNoticeTimer();
    setPendingCodigo(null);
    setPendingNombre("");
    setPendingError(null);
    setInventoryCount("");
    setInventoryError(null);
    setScanNotice({
      variant: "found",
      codigo,
      codigoProducto: relacion.codigo,
      codigoBarras: relacion.codigoBarras,
      descripcion: relacion.descripcion,
      precioVenta: relacion.precioVenta,
    });

    if (!inventoryMode) {
      scanNoticeTimerRef.current = window.setTimeout(() => {
        setScanNotice(null);
        scanNoticeTimerRef.current = null;
      }, 3000);
    }
  };

  const showAddedCode = (codigo: string) => {
    clearScanNoticeTimer();
    setPendingCodigo(null);
    setPendingNombre("");
    setPendingError(null);
    setInventoryCount("");
    setInventoryError(null);
    setScanNotice({
      variant: "added",
      codigo,
      codigoBarras: codigo,
      descripcion: "Agregado",
    });
    scanNoticeTimerRef.current = window.setTimeout(() => {
      setScanNotice(null);
      scanNoticeTimerRef.current = null;
    }, 1000);
  };

  const showDuplicateListedCode = (codigo: string) => {
    clearScanNoticeTimer();
    setScanNotice({
      variant: "duplicate",
      codigo,
      codigoBarras: codigo,
      descripcion: "Ya escaneado",
    });
    scanNoticeTimerRef.current = window.setTimeout(() => {
      setScanNotice(null);
      scanNoticeTimerRef.current = null;
    }, 1000);
  };

  const persistListedCode = async (
    empresaId: string,
    codigo: string,
  ) => {
    const baseState = stateRef.current;
    if (processingListedCodesRef.current.has(codigo)) {
      return;
    }

    processingListedCodesRef.current.add(codigo);
    const currentList = baseState.listadosPorEmpresa[empresaId] ?? [];
    const recentlyDetectedSameCode =
      lastListedCodeRef.current === codigo && Date.now() - lastListedAtRef.current < 1500;

    try {
      if (recentlyDetectedSameCode || currentList.some((item) => item.codigo === codigo)) {
        lastListedCodeRef.current = codigo;
        lastListedAtRef.current = Date.now();
        showDuplicateListedCode(codigo);
        setListStatus("Codigo ya escaneado.");
        return;
      }

      const nextItem: ListadoProductoItem = {
        codigo,
        createdAt: Date.now(),
        empresaId,
      };
      const nextState: VerificarInventarioState = {
        ...baseState,
        listadosPorEmpresa: {
          ...baseState.listadosPorEmpresa,
          [empresaId]: [...(baseState.listadosPorEmpresa[empresaId] ?? []), nextItem],
        },
      };

      await persistState(nextState);
      lastListedCodeRef.current = codigo;
      lastListedAtRef.current = Date.now();
      showAddedCode(codigo);
      setListStatus("Codigo agregado.");
    } finally {
      window.setTimeout(() => {
        processingListedCodesRef.current.delete(codigo);
      }, 1200);
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
      if (listProductsMode) {
        void persistListedCode(empresaId, codigo);
        clearDetection();
        return;
      }

      const relacion = findRelacionByCode(empresaId, codigo);

      if (relacion) {
        showFoundCode(codigo, relacion);
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
    try {
      setListProductsMode(
        window.localStorage.getItem(LISTAR_PRODUCTOS_STORAGE_KEY) === "true",
      );
    } catch {
      setListProductsMode(false);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LISTAR_PRODUCTOS_STORAGE_KEY,
        listProductsMode ? "true" : "false",
      );
    } catch {}
  }, [listProductsMode]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const savedState = await getVerificarInventarioState();
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

  const selectedEmpresaInventarios = useMemo(() => {
    if (!state.selectedEmpresaId) return [];
    return state.inventariosPorEmpresa[state.selectedEmpresaId] ?? [];
  }, [state.inventariosPorEmpresa, state.selectedEmpresaId]);

  const selectedEmpresaListados = useMemo(() => {
    if (!state.selectedEmpresaId) return [];
    return state.listadosPorEmpresa[state.selectedEmpresaId] ?? [];
  }, [state.listadosPorEmpresa, state.selectedEmpresaId]);

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

  const listedProductsExportText = useMemo(() => {
    return selectedEmpresaListados.map((item) => item.codigo).join(", ");
  }, [selectedEmpresaListados]);

  const openScannerModal = () => {
    setError(null);
    setManualSearchCodigo("");
    setManualSearchError(null);
    setIsScannerOpen(true);
  };

  const closeScannerModal = () => {
    setIsScannerOpen(false);
    setPendingCodigo(null);
    setPendingNombre("");
    setPendingError(null);
    setManualSearchCodigo("");
    setManualSearchError(null);
    setPendingStatus(null);
    setListStatus(null);
    setScanNotice(null);
    setInventoryCount("");
    setInventoryError(null);
    lastListedCodeRef.current = null;
    lastListedAtRef.current = 0;
    processingListedCodesRef.current.clear();
    clearScanNoticeTimer();
    clearDetection();
    clearScanner();
  };

  const handleManualSearch = () => {
    const empresaId = state.selectedEmpresaId;
    if (!empresaId) {
      setManualSearchError("Selecciona una empresa antes de buscar.");
      return;
    }

    const codigo = normalizeCode(manualSearchCodigo);
    if (!codigo) {
      setManualSearchError("Ingresa un código para buscar.");
      return;
    }

    setManualSearchError(null);

    if (listProductsMode) {
      void persistListedCode(empresaId, codigo);
      clearDetection();
      return;
    }

    const relacion = findRelacionByCode(empresaId, codigo);

    if (relacion) {
      showFoundCode(codigo, relacion);
      clearDetection();
      return;
    }

    clearScanNoticeTimer();
    setScanNotice(null);
    setPendingCodigo(codigo);
    setPendingNombre("");
    setPendingError(null);
    clearDetection();
  };

  const persistState = async (nextState: VerificarInventarioState) => {
    setSaving(true);
    setError(null);
    stateRef.current = nextState;
    setState(nextState);
    try {
      await saveVerificarInventarioState(nextState);
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
    const nextState: VerificarInventarioState = {
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
      inventariosPorEmpresa: {
        ...state.inventariosPorEmpresa,
        [empresaId]: state.inventariosPorEmpresa[empresaId] ?? [],
      },
      listadosPorEmpresa: {
        ...state.listadosPorEmpresa,
        [empresaId]: state.listadosPorEmpresa[empresaId] ?? [],
      },
    };

    await persistState(nextState);
    setIsAddOpen(false);
  };

  const handleSelectEmpresa = async (empresaId: string) => {
    const nextState: VerificarInventarioState = {
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
    const nextInventariosPorEmpresa = Object.fromEntries(
      Object.entries(state.inventariosPorEmpresa).filter(
        ([empresaId]) => empresaId !== deletedEmpresaId,
      ),
    );

    const nextState: VerificarInventarioState = {
      empresas: nextEmpresas,
      selectedEmpresaId: nextEmpresas[0]?.id ?? null,
      relacionesPorEmpresa: nextRelacionesPorEmpresa,
      pendientesPorEmpresa: nextPendientesPorEmpresa,
      inventariosPorEmpresa: nextInventariosPorEmpresa,
      listadosPorEmpresa: Object.fromEntries(
        Object.entries(state.listadosPorEmpresa).filter(
          ([empresaId]) => empresaId !== deletedEmpresaId,
        ),
      ),
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

      const nextState: VerificarInventarioState = {
        ...state,
        relacionesPorEmpresa: {
          ...state.relacionesPorEmpresa,
          [state.selectedEmpresaId]: relaciones,
        },
      };

      await saveVerificarInventarioState(nextState);
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

    const nextState: VerificarInventarioState = {
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

  const handleOpenManualPending = () => {
    if (!state.selectedEmpresaId) {
      setError("Selecciona una empresa antes de agregar un código.");
      return;
    }

    setError(null);
    setPendingStatus(null);
    setManualPendingCodigo("");
    setManualPendingNombre("");
    setManualPendingError(null);
    setManualAddOpen(true);
  };

  const handleSaveManualPending = async () => {
    if (!state.selectedEmpresaId) return;

    const codigoBarras = normalizeCode(manualPendingCodigo);
    const nombre = manualPendingNombre.trim();

    if (!codigoBarras) {
      setManualPendingError("Ingresa un código de barras.");
      return;
    }

    if (!nombre) {
      setManualPendingError("Ingresa un nombre.");
      return;
    }

    const empresaId = state.selectedEmpresaId;
    const nextPending: CodigoPendiente = {
      codigoBarras,
      nombre,
      createdAt: Date.now(),
      empresaId,
    };

    const nextPendientes = [
      nextPending,
      ...(state.pendientesPorEmpresa[empresaId] ?? []).filter(
        (item) => item.codigoBarras !== codigoBarras,
      ),
    ];

    const nextState: VerificarInventarioState = {
      ...state,
      pendientesPorEmpresa: {
        ...state.pendientesPorEmpresa,
        [empresaId]: nextPendientes,
      },
    };

    await persistState(nextState);
    setManualAddOpen(false);
    setManualPendingCodigo("");
    setManualPendingNombre("");
    setManualPendingError(null);
    setPendingStatus("Pendiente agregado.");
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
    const nextState: VerificarInventarioState = {
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

  const handleCopyListedProducts = async () => {
    if (!listedProductsExportText) return;

    try {
      await copyTextToClipboard(listedProductsExportText);
      setListStatus("Lista copiada.");
    } catch {
      setListStatus("No se pudo copiar lista.");
    }
  };

  const handleClearListedProducts = async () => {
    if (!state.selectedEmpresaId) return;

    const empresaId = state.selectedEmpresaId;
    const nextState: VerificarInventarioState = {
      ...state,
      listadosPorEmpresa: {
        ...state.listadosPorEmpresa,
        [empresaId]: [],
      },
    };

    await persistState(nextState);
    setListStatus("Lista limpiada.");
  };

  const handleSaveInventory = async () => {
    if (!state.selectedEmpresaId || !scanNotice) return;

    const inventario = inventoryCount.trim();
    if (!inventario) {
      setInventoryError("Ingresa inventario.");
      return;
    }

    const empresaId = state.selectedEmpresaId;
    const item: InventarioItem = {
      codigo: scanNotice.codigoProducto || scanNotice.codigo,
      descripcion: scanNotice.descripcion,
      codigoBarras: scanNotice.codigoBarras || scanNotice.codigo,
      precioVenta: scanNotice.precioVenta ?? "",
      inventario,
      createdAt: Date.now(),
      empresaId,
    };

    const itemKey = `${item.codigo}-${item.codigoBarras}`;
    const currentItems = state.inventariosPorEmpresa[empresaId] ?? [];
    const existingIndex = currentItems.findIndex(
      (current) => `${current.codigo}-${current.codigoBarras}` === itemKey,
    );

    let nextInventarios: InventarioItem[];
    if (inventoryMode && existingIndex !== -1) {
      const existing = currentItems[existingIndex];
      const existingQty = Number(existing.inventario) || 0;
      const newQty = Number(inventario) || 0;
      const updated = {
        ...existing,
        inventario: String(existingQty + newQty),
      };
      nextInventarios = currentItems.map((current, i) =>
        i === existingIndex ? updated : current,
      );
    } else {
      nextInventarios = [
        item,
        ...currentItems.filter(
          (current) => `${current.codigo}-${current.codigoBarras}` !== itemKey,
        ),
      ];
    }

    const nextState: VerificarInventarioState = {
      ...state,
      inventariosPorEmpresa: {
        ...state.inventariosPorEmpresa,
        [empresaId]: nextInventarios,
      },
    };

    await persistState(nextState);
    setScanNotice(null);
    setInventoryCount("");
    setInventoryError(null);
    setPendingStatus("Inventario guardado.");
  };

  const handleExportInventory = async () => {
    if (!selectedEmpresa || selectedEmpresaInventarios.length === 0) return;

    const XLSX = await import("xlsx");
    const rows = selectedEmpresaInventarios.map((item) => {
      const row = Object.fromEntries(PLANTILLA_HEADERS.map((header) => [header, ""]));
      row["Código"] = item.codigo;
      row["Descripción"] = item.descripcion;
      row["Código de barras"] = item.codigoBarras;
      row["Precio de Venta"] = normalizePriceValue(item.precioVenta);
      row["Inventario"] = item.inventario;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: PLANTILLA_HEADERS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
    XLSX.writeFile(
      workbook,
      `inventario-${selectedEmpresa.nombre}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleClearInventory = async () => {
    if (!state.selectedEmpresaId) return;

    const empresaId = state.selectedEmpresaId;
    const nextState: VerificarInventarioState = {
      ...state,
      inventariosPorEmpresa: {
        ...state.inventariosPorEmpresa,
        [empresaId]: [],
      },
    };

    await persistState(nextState);
    setPendingStatus("Inventario limpiado.");
  };

  const handleToggleInventoryMode = () => {
    const next = !inventoryMode;
    setInventoryMode(next);
    if (next) {
      setListProductsMode(false);
    }
    showToast(
      next ? "Modo inventariar activado." : "Modo inventariar desactivado.",
      next ? "success" : "info",
    );
  };

  const handleToggleListProductsMode = () => {
    const next = !listProductsMode;
    setListProductsMode(next);
    if (next) {
      setInventoryMode(false);
    }
    showToast(
      next ? "Modo listar productos activado." : "Modo listar productos desactivado.",
      next ? "success" : "info",
    );
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
      <VerificarInventarioHeader
        empresas={state.empresas}
        selectedEmpresaId={state.selectedEmpresaId}
        inventoryMode={inventoryMode}
        listProductsMode={listProductsMode}
        onOpenAddModal={() => setIsAddOpen(true)}
        onOpenScanner={openScannerModal}
        onToggleInventoryMode={handleToggleInventoryMode}
        onToggleListProductsMode={handleToggleListProductsMode}
        onSelectEmpresa={handleSelectEmpresa}
        onOpenDeleteModal={() => setIsDeleteOpen(true)}
        onUploadXlsx={handleUploadXlsx}
        disableUpload={saving || !state.selectedEmpresaId}
        disableScanner={!state.selectedEmpresaId}
        hideManagementControls={listProductsMode && Boolean(state.selectedEmpresaId)}
      />

      {!listProductsMode ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Códigos XLSX", selectedEmpresaRelacionesCount, "Base para verificar escaneos."],
            ["Inventario", selectedEmpresaInventarios.length, "Conteos guardados."],
            ["Listados", selectedEmpresaListados.length, "Productos agregados a lista."],
            ["Pendientes", selectedEmpresaPendientes.length, "No existen en el XLSX."],
          ].map(([label, value, helper]) => (
            <div
              key={label as string}
              className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-4 text-[var(--foreground)] shadow-sm"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {label}
              </div>
              <div className="mt-2 text-2xl font-bold">{value}</div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                {helper}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {inventoryMode && !listProductsMode ? (
      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Inventario</h2>
            <p className="text-sm opacity-70">
              {inventoryMode
                ? `Escanea productos de ${selectedEmpresa?.nombre ?? "la empresa"} y guarda cantidades.`
                : "Activa Inventariar para guardar conteos."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExportInventory()}
              disabled={!selectedEmpresaInventarios.length}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exportar inventario
            </button>
            <button
              type="button"
              onClick={() => void handleClearInventory()}
              disabled={!selectedEmpresaInventarios.length}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Limpiar
            </button>
          </div>
        </div>
        {selectedEmpresaInventarios.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {selectedEmpresaInventarios.map((item) => (
              <div
                key={`${item.codigo}-${item.codigoBarras}-${item.createdAt}`}
                className="rounded-md border border-[var(--input-border)] bg-[var(--background)] p-3"
              >
                <div className="text-sm font-semibold">{item.descripcion}</div>
                <div className="text-xs opacity-75">Código: {item.codigo}</div>
                <div className="text-xs opacity-75">
                  Código de barras: {item.codigoBarras}
                </div>
                <div className="mt-2 text-sm font-semibold">
                  Inventario: {item.inventario}
                </div>
                {item.precioVenta ? (
                  <div className="text-xs opacity-75">
                    Precio de Venta: {item.precioVenta}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm opacity-70">No hay inventario guardado.</p>
        )}
      </div>
      ) : null}

      {listProductsMode ? (
        <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Listar productos</h2>
              <p className="text-sm opacity-70">
                Escanea productos y exporta una lista separada por comas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyListedProducts()}
                disabled={!selectedEmpresaListados.length}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Exportar
              </button>
              <button
                type="button"
                onClick={() => void handleClearListedProducts()}
                disabled={!selectedEmpresaListados.length}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>
          </div>
          {selectedEmpresaListados.length > 0 ? (
            <div className="rounded-md border border-[var(--input-border)] bg-[var(--background)] p-3 text-sm">
              {listedProductsExportText}
            </div>
          ) : (
            <p className="text-sm opacity-70">No hay códigos listados.</p>
          )}
          {listStatus ? (
            <p className="mt-4 text-xs text-emerald-600">{listStatus}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-5 text-[var(--foreground)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Pendientes</h2>
            <p className="text-sm opacity-70">
              Productos escaneados que no existen en el XLSX cargado de {selectedEmpresa?.nombre ?? "la empresa seleccionada"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenManualPending}
              disabled={!state.selectedEmpresaId}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Agregar
            </button>
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
        inventoryMode={inventoryMode}
        listProductsMode={listProductsMode}
        inventoryCount={inventoryCount}
        inventoryError={inventoryError}
        onInventoryCountChange={(value) => {
          setInventoryCount(value);
          if (inventoryError) setInventoryError(null);
        }}
        onInventorySave={() => {
          void handleSaveInventory();
        }}
        onInventoryCancel={() => {
          setScanNotice(null);
          setInventoryCount("");
          setInventoryError(null);
        }}
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
        manualAddOpen={manualAddOpen}
        manualPendingCodigo={manualPendingCodigo}
        manualPendingNombre={manualPendingNombre}
        manualPendingError={manualPendingError}
        onManualPendingCodigoChange={(value) => {
          setManualPendingCodigo(value);
          if (manualPendingError) setManualPendingError(null);
        }}
        onManualPendingNombreChange={(value) => {
          setManualPendingNombre(value);
          if (manualPendingError) setManualPendingError(null);
        }}
        onManualPendingClose={() => {
          setManualAddOpen(false);
          setManualPendingCodigo("");
          setManualPendingNombre("");
          setManualPendingError(null);
        }}
        onManualPendingSave={() => {
          void handleSaveManualPending();
        }}
        manualSearchCodigo={manualSearchCodigo}
        manualSearchError={manualSearchError}
        onManualSearchCodigoChange={(value) => {
          setManualSearchCodigo(value);
          if (manualSearchError) setManualSearchError(null);
        }}
        onManualSearch={handleManualSearch}
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
