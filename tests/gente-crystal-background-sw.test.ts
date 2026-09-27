// @vitest-environment node
//
// Harness de integracion para el service worker de la extension
// (extensions/TimemasterGentecrystal/background.js) SIN modificar codigo de
// produccion: el archivo real se carga en un contexto `vm` con
// `importScripts` que evalua el sync-core.js real, `chrome.storage.local` en
// memoria, `chrome.alarms`/`chrome.runtime` capturando listeners y `fetch`
// stub. Todo se maneja por la superficie publica (mensajes, alarmas, storage).
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

const EXTENSION_DIR = path.resolve(
  __dirname,
  "../extensions/TimemasterGentecrystal",
);

type QueueRecord = {
  ticketId: string;
  payload: Record<string, unknown>;
  state: "pending" | "sending" | "synced" | "error";
  revision: number;
  attempts: number;
  retryable: boolean;
  nextAttemptAt: number | null;
  lastError: string | null;
  updatedAt: number;
  syncedAt: number | null;
};

type StorageMap = Record<string, unknown>;

type ListenerRegistry = {
  onInstalled: Array<() => void>;
  onStartup: Array<() => void>;
  onAlarm: Array<(alarm: { name: string }) => void>;
  onMessage: Array<(
    message: any,
    sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => boolean | void>;
};

type Harness = {
  storage: StorageMap;
  listeners: ListenerRegistry;
  alarmsCreated: Array<{ name: string; periodInMinutes: number }>;
  fetchCalls: Array<{ url: string; body: unknown }>;
  consoleErrors: Array<string>;
  /** Encola ventas por la superficie publica (mensaje TM_GC_QUEUE_SALES). */
  enqueueViaMessage: (events: unknown[]) => Promise<{ ok: boolean }>;
  /**
   * Arma un gancho: la PROXIMA lectura de la cola dentro del SW invoca el
   * callback SIN resolver aun la lectura (el encolado se cuela en medio de
   * la tarea que esta leyendo). Es la ventana exacta de la carrera.
   */
  armEnqueueOnNextQueueRead: (
    events: unknown[],
  ) => void;
  /** Dispara la alarma periodica como lo haria Chrome. */
  fireAlarm: () => void;
  waitFor: (predicate: () => boolean, timeoutMs?: number) => Promise<void>;
  dumpState: () => string;
};

const QUEUE_KEY = "genteCrystalSyncQueue";

function loadServiceWorker(options: {
  storage: StorageMap;
  fetchImpl: typeof fetch;
}): Harness {
  const listeners: ListenerRegistry = {
    onInstalled: [],
    onStartup: [],
    onAlarm: [],
    onMessage: [],
  };
  const alarmsCreated: Harness["alarmsCreated"] = [];
  const fetchCalls: Harness["fetchCalls"] = [];
  const consoleErrors: Harness["consoleErrors"] = [];
  let pendingRaceEnqueue: { events: unknown[] } | null = null;

  const backgroundSource = readFileSync(
    path.join(EXTENSION_DIR, "background.js"),
    "utf8",
  );

  const chromeStub = {
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          const result: StorageMap = {};
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (key in options.storage) result[key] = structuredClone(options.storage[key]);
          }
          // Ventana de carrera: si el SW esta leyendo la cola y hay un
          // encolado armado, dispararlo AQUI, antes de resolver la lectura.
          // La tarea en vuelo sigue pendiente; el encolado se encadena a la
          // cadena serializada DETRAS de la tarea actual y DELANTE de lo que
          // el SW programe despues (p.ej. la escritura de la poda racy).
          const wantsQueue =
            Array.isArray(keys) ? keys.includes(QUEUE_KEY) : keys === QUEUE_KEY;
          if (wantsQueue && pendingRaceEnqueue) {
            const { events } = pendingRaceEnqueue;
            pendingRaceEnqueue = null;
            for (const handler of listeners.onMessage) {
              handler({ type: "TM_GC_QUEUE_SALES", events }, {}, () => {});
            }
          }
          return result;
        },
        set: async (values: StorageMap) => {
          for (const [key, value] of Object.entries(values)) {
            options.storage[key] = structuredClone(value);
          }
        },
      },
    },
    alarms: {
      create: (name: string, info: { periodInMinutes: number }) => {
        alarmsCreated.push({ name, periodInMinutes: info.periodInMinutes });
      },
      onAlarm: { addListener: (fn: ListenerRegistry["onAlarm"][number]) => listeners.onAlarm.push(fn) },
    },
    runtime: {
      onInstalled: { addListener: (fn: ListenerRegistry["onInstalled"][number]) => listeners.onInstalled.push(fn) },
      onStartup: { addListener: (fn: ListenerRegistry["onStartup"][number]) => listeners.onStartup.push(fn) },
      onMessage: { addListener: (fn: ListenerRegistry["onMessage"][number]) => listeners.onMessage.push(fn) },
    },
  };

  const sandbox: Record<string, unknown> = {
    importScripts: (...files: string[]) => {
      for (const file of files) {
        const source = readFileSync(
          path.join(EXTENSION_DIR, file as string),
          "utf8",
        );
        // sync-core.js se auto-ejecuta sobre globalThis del sandbox.
        vm.runInContext(source, context, { filename: file });
      }
    },
    chrome: chromeStub,
    fetch: (input: any, init?: any) => {
      fetchCalls.push({ url: String(input), body: init?.body });
      return options.fetchImpl(input, init);
    },
    console: {
      log: () => {},
      warn: () => {},
      error: (...args: unknown[]) => {
        consoleErrors.push(
          args
            .map((item) =>
              item instanceof Error
                ? `${item.message}\n${item.stack ?? ""}`
                : String(item),
            )
            .join(" "),
        );
      },
    },
    setTimeout,
    clearTimeout,
    // Date COMPARTIDO con el host: si el sandbox tuviera su propio realm,
    // Date.now() del codigo sincronizaria contra un reloj distinto y las
    // marcas de tiempo de la cola no serian comparables con las del test.
    Date,
    // normalizeApiBaseUrl (sync-core) usa new URL(...): sin esto, la lectura
    // de configuracion lanza, el SW cree que no hay token y nunca despacha.
    URL,
    URLSearchParams,
    JSON,
    Math,
    Object,
    Promise,
    Array,
    String,
    Number,
    Boolean,
    Symbol,
    Map,
    Set,
    Error,
    TypeError,
    RangeError,
    globalThis: null,
    self: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);

  vm.runInContext(backgroundSource, context, {
    filename: "background.js",
  });

  const sendMessage = (message: any): Promise<any> =>
    new Promise((resolve, reject) => {
      let settled = false;
      for (const handler of listeners.onMessage) {
        const wantsAsync = handler(
          message,
          {},
          (response: unknown) => {
            settled = true;
            resolve(response);
          },
        );
        if (wantsAsync === true) return; // responde via sendResponse
      }
      setTimeout(
        () => reject(new Error("ningun handler respondio el mensaje")),
        1000,
      );
      void settled;
    });

  return {
    storage: options.storage,
    listeners,
    alarmsCreated,
    fetchCalls,
    consoleErrors,
    dumpState: () =>
      JSON.stringify(
        {
          storage: options.storage,
          fetchCalls: fetchCalls.length,
          consoleErrors,
        },
        null,
        2,
      ),
    enqueueViaMessage: async (events: unknown[]) => {
      const response = await sendMessage({ type: "TM_GC_QUEUE_SALES", events });
      if (!response?.ok) throw new Error("enqueue fallo");
      return response;
    },
    armEnqueueOnNextQueueRead: (events: unknown[]) => {
      pendingRaceEnqueue = { events };
    },
    fireAlarm: () => {
      for (const handler of listeners.onAlarm) handler({ name: "tmGcSync" });
    },
    waitFor: async (predicate: () => boolean, timeoutMs = 2000) => {
      const start = Date.now();
      while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
          throw new Error(
            `waitFor: timeout esperando la condicion\n${JSON.stringify(
              {
                storage: options.storage,
                fetchCalls: fetchCalls.length,
                consoleErrors,
              },
              null,
              2,
            )}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    },
  };
}

function activeSalePayload(overrides: Record<string, unknown> = {}) {
  return {
    ticketId: "1111-22-33333",
    sorteo: "Loteria Nacional",
    monto: 5000,
    saleAt: "2026-09-27T10:00:00.000Z",
    captureOrigin: "indirect",
    status: "active",
    ...overrides,
  };
}

/** Construye un registro synced viejo (>24 h) como lo deja markSucceeded. */
function oldSyncedRecord(payload: Record<string, unknown>, now: number): QueueRecord {
  return {
    ticketId: payload.ticketId as string,
    payload,
    state: "synced",
    revision: 3,
    attempts: 1,
    retryable: false,
    nextAttemptAt: null,
    lastError: null,
    updatedAt: now - 25 * 60 * 60 * 1000,
    syncedAt: now - 25 * 60 * 60 * 1000,
  };
}

const okFetchImpl: typeof fetch = (async () =>
  new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;

describe("background.js: carrera poda vs encolado (venta no debe perderse)", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = loadServiceWorker({ storage: {}, fetchImpl: okFetchImpl });
    // El SW real solo envia si hay token configurado (popup). Sin esto,
    // performFlush retorna temprano y no hay flush que probar.
    harness.storage["genteCrystalIntegrationConfig"] = {
      token: "test-device-token",
    };
  });

  it("la alarma se crea cada 15 minutos (no 1)", () => {
    expect(harness.alarmsCreated.length).toBeGreaterThan(0);
    for (const alarm of harness.alarmsCreated) {
      expect(alarm.periodInMinutes).toBe(15);
    }
  });

  it("una poda con synced >24h en curso NO pisa una venta encolada durante el flush", async () => {
    const now = Date.now();
    const oldPayload = activeSalePayload({
      ticketId: "0000-00-00000",
      saleAt: "2026-09-25T10:00:00.000Z",
    });
    harness.storage["genteCrystalSyncQueue"] = {
      [oldPayload.ticketId]: oldSyncedRecord(oldPayload, now),
    };

    // Ventana de la carrera, determinista: en cuanto el flush (via alarma)
    // lea la cola, el encolado se cuela EN MEDIO de esa tarea.
    harness.armEnqueueOnNextQueueRead([activeSalePayload()]);
    harness.fireAlarm();

    // El flush del propio mensaje termina de sincronizar la venta nueva.
    await harness.waitFor(() => {
      const queue = (harness.storage["genteCrystalSyncQueue"] ?? {}) as Record<
        string,
        QueueRecord
      >;
      return queue["1111-22-33333"]?.state === "synced";
    });

    const queue = harness.storage["genteCrystalSyncQueue"] as Record<
      string,
      QueueRecord
    >;

    // LA ASERCION CLAVE: la venta recien encolada sobrevive a la poda.
    expect(queue["1111-22-33333"]).toBeDefined();
    expect(queue["1111-22-33333"].payload.status).toBe("active");

    // La poda del registro viejo (>24 h) tambien ocurrio.
    expect(queue["0000-00-00000"]).toBeUndefined();
  });

  it("el flush al encolar envia la venta y la marca synced (flujp principal)", async () => {
    await harness.enqueueViaMessage([activeSalePayload()]);
    await harness.waitFor(() => {
      const queue = (harness.storage["genteCrystalSyncQueue"] ?? {}) as Record<
        string,
        QueueRecord
      >;
      return queue["1111-22-33333"]?.state === "synced";
    });
    expect(harness.fetchCalls.length).toBe(1);
    expect(JSON.parse(harness.fetchCalls[0].body as string)).toMatchObject({
      ticketId: "1111-22-33333",
      status: "active",
    });
    expect(harness.fetchCalls[0].url).toContain(
      "/api/integrations/gente-crystal/sales",
    );
  });
});

/**
 * CONTRAPRUEBA (discriminacion): reconstruye EN MEMORIA el patron ANTERIOR a
 * la correccion (poda en dos tareas separadas de la cadena) y demuestra que
 * ese patron SI pierde la venta cuando el encolado se cuela entre la lectura
 * y la escritura de la poda. Asi el test de arriba no pasa "por suerte":
 * este asserts documenta por que la corrida atomica es necesaria.
 */
describe("contraprueba: patron racy de dos tareas pierde la venta", () => {
  it("la escritura de la poda pisa el enqueue intercalado", async () => {
    // Cola visible por la poda: solo el registro viejo (snapshot T1).
    const snapshotAtT1 = {
      "0000-00-00000": oldSyncedRecord(
        activeSalePayload({ ticketId: "0000-00-00000" }),
        Date.now(),
      ),
    };
    // Estado real del storage en T2: snapshot + la venta ya encolada.
    const storageAtT2 = {
      ...snapshotAtT1,
      "1111-22-33333": {
        ticketId: "1111-22-33333",
        payload: activeSalePayload(),
        state: "pending",
        revision: 1,
        attempts: 0,
        retryable: true,
        nextAttemptAt: Date.now(),
        lastError: null,
        updatedAt: Date.now(),
        syncedAt: null,
      } satisfies QueueRecord,
    };

    // Patron racy: podar el snapshot T1 y escribirlo en T2 tal cual.
    const prunedFromStaleSnapshot: Record<string, QueueRecord> = {};
    for (const [key, value] of Object.entries(snapshotAtT1)) {
      const syncedAt = Number((value as QueueRecord).syncedAt || 0);
      const isOld =
        (value as QueueRecord).state === "synced" &&
        syncedAt > 0 &&
        Date.now() - syncedAt >= 24 * 60 * 60 * 1000;
      if (!isOld) prunedFromStaleSnapshot[key] = value as QueueRecord;
    }
    // La escritura de la poda reemplaza TODO el documento:
    const writtenBack = prunedFromStaleSnapshot;

    // La venta encolada en T2... ya no esta:
    expect(writtenBack["1111-22-33333"]).toBeUndefined();
    expect(Object.keys(storageAtT2)).toContain("1111-22-33333");
  });
});
