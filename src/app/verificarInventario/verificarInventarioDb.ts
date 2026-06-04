export type Empresa = {
  id: string;
  nombre: string;
  createdAt: number;
};

export type RelacionProducto = {
  codigo?: string;
  descripcion: string;
  codigoBarras: string;
  precioVenta?: string;
};

export type CodigoPendiente = {
  codigoBarras: string;
  nombre: string;
  createdAt: number;
  empresaId: string;
};

export type InventarioItem = {
  codigo: string;
  descripcion: string;
  codigoBarras: string;
  precioVenta: string;
  inventario: string;
  createdAt: number;
  empresaId: string;
};

export type VerificarInventarioState = {
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  relacionesPorEmpresa: Record<string, RelacionProducto[]>;
  pendientesPorEmpresa: Record<string, CodigoPendiente[]>;
  inventariosPorEmpresa: Record<string, InventarioItem[]>;
};

const DB_NAME = "verificar-inventario-db";
const LEGACY_DB_NAME = "existe-db";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const STATE_KEY = "state";

let dbPromise: Promise<IDBDatabase> | null = null;
let legacyDbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openOnce(dbName = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("No se pudo abrir IndexedDB"));
    request.onblocked = () =>
      reject(new Error("IndexedDB bloqueada por otra pestana/instancia"));
  });
}

export async function openVerificarInventarioDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    throw new Error("IndexedDB no esta disponible en este entorno.");
  }

  if (!dbPromise) {
    dbPromise = openOnce();
  }

  return dbPromise;
}

async function openLegacyDb(): Promise<IDBDatabase> {
  if (!legacyDbPromise) {
    legacyDbPromise = openOnce(LEGACY_DB_NAME);
  }

  return legacyDbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Error en operacion IndexedDB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Transaccion IndexedDB fallida"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Transaccion IndexedDB abortada"));
  });
}

function normalizeState(
  value: Partial<VerificarInventarioState> | null | undefined,
): VerificarInventarioState {
  const empresas = Array.isArray(value?.empresas)
    ? value.empresas
        .filter((empresa): empresa is Empresa => {
          return Boolean(empresa?.id && empresa?.nombre);
        })
        .map((empresa) => ({
          id: String(empresa.id),
          nombre: String(empresa.nombre),
          createdAt: Number(empresa.createdAt) || Date.now(),
        }))
    : [];

  const selectedEmpresaId =
    typeof value?.selectedEmpresaId === "string" &&
    empresas.some((empresa) => empresa.id === value.selectedEmpresaId)
      ? value.selectedEmpresaId
      : null;

  const rawRelaciones = value?.relacionesPorEmpresa;
  const relacionesPorEmpresa: Record<string, RelacionProducto[]> = {};
  const rawPendientes = value?.pendientesPorEmpresa;
  const pendientesPorEmpresa: Record<string, CodigoPendiente[]> = {};
  const rawInventarios = value?.inventariosPorEmpresa;
  const inventariosPorEmpresa: Record<string, InventarioItem[]> = {};

  if (rawRelaciones && typeof rawRelaciones === "object") {
    for (const empresa of empresas) {
      const relaciones = (rawRelaciones as Record<string, unknown>)[empresa.id];
      if (!Array.isArray(relaciones)) continue;

      relacionesPorEmpresa[empresa.id] = relaciones
        .map((item) => {
          if (!item || typeof item !== "object") return null;

          const itemRecord = item as Record<string, unknown>;
          const codigo = String(itemRecord.codigo ?? "").trim();
          const descripcion = String(itemRecord.descripcion ?? "").trim();
          const codigoBarras = String(itemRecord.codigoBarras ?? "").trim() || "NE";
          const precioVenta = String(itemRecord.precioVenta ?? "").trim();

          if (!descripcion) return null;

          return {
            ...(codigo ? { codigo } : {}),
            descripcion,
            codigoBarras,
            ...(precioVenta ? { precioVenta } : {}),
          };
        })
        .filter((item): item is RelacionProducto => Boolean(item));
    }
  }

  if (rawPendientes && typeof rawPendientes === "object") {
    for (const empresa of empresas) {
      const pendientes = (rawPendientes as Record<string, unknown>)[empresa.id];
      if (!Array.isArray(pendientes)) continue;

      pendientesPorEmpresa[empresa.id] = pendientes
        .map((item) => {
          if (!item || typeof item !== "object") return null;

          const itemRecord = item as Record<string, unknown>;
          const codigoBarras = String(itemRecord.codigoBarras ?? "").trim();
          const nombre = String(itemRecord.nombre ?? "").trim();

          if (!codigoBarras || !nombre) return null;

          return {
            codigoBarras,
            nombre,
            createdAt: Number(itemRecord.createdAt) || Date.now(),
            empresaId: empresa.id,
          };
        })
        .filter((item): item is CodigoPendiente => Boolean(item));
    }
  }

  if (rawInventarios && typeof rawInventarios === "object") {
    for (const empresa of empresas) {
      const inventarios = (rawInventarios as Record<string, unknown>)[empresa.id];
      if (!Array.isArray(inventarios)) continue;

      inventariosPorEmpresa[empresa.id] = inventarios
        .map((item) => {
          if (!item || typeof item !== "object") return null;

          const itemRecord = item as Record<string, unknown>;
          const codigo = String(itemRecord.codigo ?? "").trim();
          const descripcion = String(itemRecord.descripcion ?? "").trim();
          const codigoBarras = String(itemRecord.codigoBarras ?? "").trim();
          const precioVenta = String(itemRecord.precioVenta ?? "").trim();
          const inventario = String(itemRecord.inventario ?? "").trim();

          if (!descripcion || !inventario) return null;

          return {
            codigo,
            descripcion,
            codigoBarras,
            precioVenta,
            inventario,
            createdAt: Number(itemRecord.createdAt) || Date.now(),
            empresaId: empresa.id,
          };
        })
        .filter((item): item is InventarioItem => Boolean(item));
    }
  }

  return {
    empresas,
    selectedEmpresaId,
    relacionesPorEmpresa,
    pendientesPorEmpresa,
    inventariosPorEmpresa,
  };
}

async function readStateFromDb(
  db: IDBDatabase,
): Promise<Partial<VerificarInventarioState> | undefined> {
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const entry = await requestToPromise(
    store.get(STATE_KEY) as IDBRequest<{
      key: string;
      value?: Partial<VerificarInventarioState>;
    } | undefined>,
  );

  await txDone(tx);

  return entry?.value;
}

export async function getVerificarInventarioState(): Promise<VerificarInventarioState> {
  const db = await openVerificarInventarioDb();
  const value = await readStateFromDb(db);

  if (value) {
    return normalizeState(value);
  }

  try {
    const legacyValue = await readStateFromDb(await openLegacyDb());
    const migratedState = normalizeState(legacyValue);
    if (migratedState.empresas.length > 0) {
      await saveVerificarInventarioState(migratedState);
    }
    return migratedState;
  } catch {
    return normalizeState(null);
  }
}

export async function saveVerificarInventarioState(
  state: VerificarInventarioState,
): Promise<void> {
  const db = await openVerificarInventarioDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const normalized = normalizeState(state);
  store.put({ key: STATE_KEY, value: normalized });

  await txDone(tx);
}
