export type Empresa = {
  id: string;
  nombre: string;
  createdAt: number;
};

export type RelacionProducto = {
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

export type ExisteState = {
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  relacionesPorEmpresa: Record<string, RelacionProducto[]>;
  pendientesPorEmpresa: Record<string, CodigoPendiente[]>;
};

const DB_NAME = "existe-db";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const STATE_KEY = "state";

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openOnce(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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
      reject(new Error("IndexedDB bloqueada por otra pestaña/instancia"));
  });
}

export async function openExisteDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    throw new Error("IndexedDB no está disponible en este entorno.");
  }

  if (!dbPromise) {
    dbPromise = openOnce();
  }

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Error en operación IndexedDB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Transacción IndexedDB fallida"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Transacción IndexedDB abortada"));
  });
}

function normalizeState(value: Partial<ExisteState> | null | undefined): ExisteState {
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

  if (rawRelaciones && typeof rawRelaciones === "object") {
    for (const empresa of empresas) {
      const relaciones = (rawRelaciones as Record<string, unknown>)[empresa.id];
      if (!Array.isArray(relaciones)) continue;

      relacionesPorEmpresa[empresa.id] = relaciones
        .map((item) => {
          if (!item || typeof item !== "object") return null;

          const itemRecord = item as Record<string, unknown>;
          const descripcion = String(itemRecord.descripcion ?? "").trim();
          const codigoBarras = String(itemRecord.codigoBarras ?? "").trim() || "NE";
          const precioVenta = String(itemRecord.precioVenta ?? "").trim();

          if (!descripcion) return null;

          return {
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

  return {
    empresas,
    selectedEmpresaId,
    relacionesPorEmpresa,
    pendientesPorEmpresa,
  };
}

export async function getExisteState(): Promise<ExisteState> {
  const db = await openExisteDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const entry = await requestToPromise(
    store.get(STATE_KEY) as IDBRequest<{ key: string; value?: Partial<ExisteState> } | undefined>,
  );

  await txDone(tx);

  return normalizeState(entry?.value);
}

export async function saveExisteState(state: ExisteState): Promise<void> {
  const db = await openExisteDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const normalized = normalizeState(state);
  store.put({ key: STATE_KEY, value: normalized });

  await txDone(tx);
}
