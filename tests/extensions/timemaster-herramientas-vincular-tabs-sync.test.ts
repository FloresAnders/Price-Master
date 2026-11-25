import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const core = requireModule(
  resolve(
    process.cwd(),
    "extensions/TimeMasterHerramientas/vinculartabs-core.js",
  ),
);

type Product = {
  pId: string;
  uIdInventario: number;
  uCantidad: number;
  uPrecio: number;
  [key: string]: unknown;
};
type PosRecord = {
  id?: number;
  uidUser: string;
  tab: number;
  productos: Product[];
  datos: Record<string, unknown>;
};
type SyncOperation = {
  operationId: string;
  tab: number;
  record: PosRecord | null;
  targets: string[];
  expectedFingerprints: Record<string, string>;
  baseRecord?: PosRecord | null;
  initializeUid?: string | null;
};

function product(pId: string, quantity: number): Product {
  return { pId, uIdInventario: 1, uCantidad: quantity, uPrecio: 100 };
}

function quantities(record: PosRecord | null | undefined) {
  return Object.fromEntries(
    (record?.productos || []).map((item) => [item.pId, item.uCantidad]),
  );
}

function fixture() {
  const records = new Map<string, PosRecord>();
  const key = (uid: string, tab: number) => `${uid}:${tab}`;
  let uid = "A";
  const stored: Record<string, unknown> = {
    tmhVincularTabsEnabled: true,
    tmhVincularTabsStart: 7,
    tmhVincularTabsEnd: 7,
  };
  let failNextFinalStateSave = false;
  let afterRead: (() => void) | null = null;
  let afterPendingSave: (() => void) | null = null;
  const receipts = new Map<
    number,
    { operationId: string; record: PosRecord | null; targets: string[] }
  >();
  const storage = {
    async get(keys: string[]) {
      return structuredClone(
        Object.fromEntries(keys.map((name) => [name, stored[name]])),
      );
    },
    async set(next: Record<string, unknown>) {
      const state = next.tmhVincularTabsState as
        | { pending?: unknown }
        | undefined;
      if (failNextFinalStateSave && !state?.pending) {
        failNextFinalStateSave = false;
        throw new Error("storage unavailable");
      }
      Object.assign(stored, structuredClone(next));
      if (state?.pending && afterPendingSave) {
        const callback = afterPendingSave;
        afterPendingSave = null;
        callback();
      }
    },
  };
  const database = {
    async getDurableState(start: number, end: number) {
      return structuredClone(
        [...receipts.entries()]
          .filter(([tab]) => tab >= start && tab <= end)
          .map(([tab, receipt]) => ({
            tab,
            record: receipt.record,
            targets: receipt.targets,
          })),
      );
    },
    async getRecordsForUser(user: string, start: number, end: number) {
      const result = structuredClone([...records.values()].filter(
        (record) =>
          record.uidUser === user && record.tab >= start && record.tab <= end,
      ));
      const callback = afterRead;
      afterRead = null;
      callback?.();
      return result;
    },
    async replaceForUsers(
      tab: number,
      shared: PosRecord | null,
      users: string[],
    ) {
      for (const user of users) {
        const existing = records.get(key(user, tab));
        if (!shared) {
          records.delete(key(user, tab));
          continue;
        }
        records.set(key(user, tab), core.cloneForUser(shared, user, tab, existing));
      }
    },
    operationStatus(operation: SyncOperation) {
      if (receipts.get(operation.tab)?.operationId === operation.operationId) {
        return "already-applied";
      }
      const desired = core.fingerprintRecord(operation.record);
      const current = Object.fromEntries(
        operation.targets.map((user) => [user, records.get(key(user, operation.tab))]),
      );
      if (
        operation.targets.every(
          (user) => core.fingerprintRecord(current[user]) === desired,
        )
      ) {
        return "already-applied";
      }
      if (
        operation.targets.every(
          (user) =>
            core.fingerprintRecord(current[user]) ===
            operation.expectedFingerprints[user],
        )
      ) {
        return "ready";
      }
      return "conflict";
    },
    async inspectOperation(operation: SyncOperation) {
      const status = database.operationStatus(operation);
      const receipt = receipts.get(operation.tab);
      if (
        status === "already-applied" &&
        receipt?.operationId === operation.operationId &&
        core.fingerprintRecord(receipt.record) !==
          core.fingerprintRecord(operation.record)
      ) {
        return { status, record: structuredClone(receipt.record) };
      }
      return status;
    },
    async confirmOperation(operation: SyncOperation) {
      const result = await database.inspectOperation(operation);
      const status = typeof result === "string" ? result : result.status;
      if (status === "already-applied" && typeof result === "string") {
        receipts.set(operation.tab, {
          operationId: operation.operationId,
          record: structuredClone(operation.record),
          targets: [...operation.targets],
        });
      }
      return result;
    },
    async applyOperation(operation: SyncOperation) {
      const status = database.operationStatus(operation);
      if (status === "already-applied") {
        const receipt = receipts.get(operation.tab);
        if (
          receipt?.operationId === operation.operationId &&
          core.fingerprintRecord(receipt.record) !==
            core.fingerprintRecord(operation.record)
        ) {
          return { status, record: structuredClone(receipt.record) };
        }
        receipts.set(operation.tab, {
          operationId: operation.operationId,
          record: structuredClone(operation.record),
          targets: [...operation.targets],
        });
        return status;
      }
      if (status === "conflict") {
        const current = operation.targets.map((user) =>
          records.get(key(user, operation.tab)),
        );
        const merged = operation.initializeUid
          ? core.mergeJoiningConflict(
              operation.baseRecord,
              operation.targets
                .filter((user) => user !== operation.initializeUid)
                .map((user) => records.get(key(user, operation.tab))),
              records.get(key(operation.initializeUid, operation.tab)),
            )
          : core.mergeConcurrentRecords(
              operation.baseRecord,
              current,
              operation.record,
            );
        await database.replaceForUsers(
          operation.tab,
          merged,
          operation.targets,
        );
        receipts.set(operation.tab, {
          operationId: operation.operationId,
          record: structuredClone(merged),
          targets: [...operation.targets],
        });
        return { status: "merged", record: merged };
      }
      await database.replaceForUsers(
        operation.tab,
        operation.record,
        operation.targets,
      );
      receipts.set(operation.tab, {
        operationId: operation.operationId,
        record: structuredClone(operation.record),
        targets: [...operation.targets],
      });
      return "applied";
    },
  };
  const controller = core.createSyncController({
    storage,
    database,
    getContext: () => ({ uid }),
    requestReload: () => {},
  });
  return {
    records,
    run: () => controller.run(),
    setUid: (next: string) => {
      uid = next;
    },
    put(
      user: string,
      tab: number,
      products: Product[],
      datos: Record<string, unknown> = {},
    ) {
      records.set(key(user, tab), {
        id: records.size + 1,
        uidUser: user,
        tab,
        productos: products,
        datos,
      });
    },
    get(user: string, tab: number) {
      return records.get(key(user, tab));
    },
    remove(user: string, tab: number) {
      records.delete(key(user, tab));
    },
    failNextStateSave() {
      failNextFinalStateSave = true;
    },
    afterNextRead(callback: () => void) {
      afterRead = callback;
    },
    afterNextPendingSave(callback: () => void) {
      afterPendingSave = callback;
    },
    setEnabled(enabled: boolean) {
      stored.tmhVincularTabsEnabled = enabled;
    },
    setRange(start: number, end: number) {
      stored.tmhVincularTabsStart = start;
      stored.tmhVincularTabsEnd = end;
    },
    clearExtensionState() {
      delete stored.tmhVincularTabsState;
    },
    master(tab: number) {
      return (stored.tmhVincularTabsState as { masters?: Record<number, PosRecord> })
        ?.masters?.[tab];
    },
    receipt(tab: number) {
      return receipts.get(tab);
    },
  };
}

describe("TimeMasterHerramientas sincronización de TABs", () => {
  it("fusiona una sola vez los productos preexistentes de dos cuentas", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("A", 1), product("B", 5), product("C", 2)]);
    await sync.run();

    sync.put("B", 7, [product("M", 3), product("N", 4)]);
    sync.setUid("B");
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ A: 1, B: 5, C: 2, M: 3, N: 4 });
    expect(quantities(sync.get("B", 7))).toEqual({ A: 1, B: 5, C: 2, M: 3, N: 4 });

    await sync.run();
    expect(quantities(sync.get("A", 7))).toEqual({ A: 1, B: 5, C: 2, M: 3, N: 4 });
  });

  it("no vuelve a sumar tras perder el estado local de la extension", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    await sync.run();
    expect(quantities(sync.get("A", 7))).toEqual({ C: 5 });

    sync.clearExtensionState();
    sync.setUid("A");
    await sync.run();
    sync.setUid("B");
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 5 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 5 });
  });

  it("no deja que un recibo viejo reemplace un maestro mas reciente", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    await sync.run();

    sync.put("A", 7, [product("C", 6)]);
    sync.put("B", 7, [product("C", 6)]);
    sync.setUid("A");
    await sync.run();
    sync.put("A", 7, [product("C", 7)]);
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 7 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 7 });
  });

  it("conserva productos al recrear una TAB borrada en todas las cuentas", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    await sync.run();

    sync.remove("A", 7);
    sync.remove("B", 7);
    sync.setUid("A");
    await sync.run();
    expect(sync.master(7)).toBeUndefined();
    expect(sync.receipt(7)?.record).toBeNull();
    sync.put("A", 7, [product("C", 3)]);
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 3 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 3 });
  });

  it("actualiza recibo si el rango cambia durante una operacion pendiente", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    await sync.run();

    sync.put("A", 7, [product("C", 6)]);
    sync.setUid("A");
    sync.afterNextPendingSave(() => {
      sync.put("B", 7, [product("C", 6)]);
      sync.setRange(8, 8);
    });
    await sync.run();
    sync.clearExtensionState();
    sync.setRange(7, 7);
    sync.put("A", 7, [product("C", 7)]);
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 7 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 7 });
  });

  it("replica cantidades y productos nuevos después de inicializar", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.setUid("B");
    await sync.run();

    sync.put("B", 7, [product("C", 4), product("M", 2), product("N", 1)]);
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 4, M: 2, N: 1 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 4, M: 2, N: 1 });
  });

  it("no toca TABs fuera del rango configurado", async () => {
    const sync = fixture();
    sync.put("A", 6, [product("FUERA", 1)]);
    await sync.run();
    sync.setUid("B");
    await sync.run();

    expect(sync.get("B", 6)).toBeUndefined();
    expect(quantities(sync.get("A", 6))).toEqual({ FUERA: 1 });
  });

  it("recupera una escritura aplicada sin sumar otra vez tras fallar storage", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    sync.failNextStateSave();

    await expect(sync.run()).rejects.toThrow("storage unavailable");
    expect(quantities(sync.get("A", 7))).toEqual({ C: 5 });
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 5 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 5 });
  });

  it("usa un recibo durable si hubo una edición después del fallo de storage", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    sync.failNextStateSave();
    await expect(sync.run()).rejects.toThrow("storage unavailable");
    sync.put("B", 7, [product("C", 6)]);

    await sync.run();
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 6 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 6 });
  });

  it("no sobrescribe una edición ocurrida después de leer la cuenta activa", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    sync.afterNextRead(() => sync.put("B", 7, [product("C", 4)]));

    await sync.run();
    expect(quantities(sync.get("B", 7))).toEqual({ C: 6 });
    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 6 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 6 });
  });

  it("cancela la operación si se desactiva durante la lectura", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("M", 1)]);
    sync.setUid("B");
    sync.afterNextRead(() => sync.setEnabled(false));

    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 2 });
    expect(quantities(sync.get("B", 7))).toEqual({ M: 1 });
  });

  it("combina deltas si dos cuentas editaron antes de sincronizar", async () => {
    const sync = fixture();
    sync.put("A", 7, [product("C", 2)]);
    await sync.run();
    sync.put("B", 7, [product("C", 3)]);
    sync.setUid("B");
    await sync.run();
    sync.put("A", 7, [product("C", 6)]);
    sync.put("B", 7, [product("C", 7)]);
    sync.setUid("A");

    await sync.run();

    expect(quantities(sync.get("A", 7))).toEqual({ C: 8 });
    expect(quantities(sync.get("B", 7))).toEqual({ C: 8 });
  });

  it("combina cambios concurrentes en campos distintos de datos", async () => {
    const sync = fixture();
    const baseData = { cliente: "BASE", observacion: "BASE" };
    sync.put("A", 7, [product("C", 2)], baseData);
    await sync.run();
    sync.setUid("B");
    await sync.run();
    sync.put("A", 7, [product("C", 2)], {
      cliente: "CLIENTE A",
      observacion: "BASE",
    });
    sync.put("B", 7, [product("C", 2)], {
      cliente: "BASE",
      observacion: "OBS B",
    });
    sync.setUid("A");

    await sync.run();

    expect(sync.get("A", 7)?.datos).toEqual({
      cliente: "CLIENTE A",
      observacion: "OBS B",
    });
    expect(sync.get("B", 7)?.datos).toEqual({
      cliente: "CLIENTE A",
      observacion: "OBS B",
    });
  });

  it("conserva cambios concurrentes en propiedades de un producto", async () => {
    const sync = fixture();
    const baseProduct = { ...product("C", 2), notaCompartida: "BASE" };
    sync.put("A", 7, [baseProduct], { observacion: "BASE" });
    await sync.run();
    sync.setUid("B");
    await sync.run();
    sync.put("A", 7, [{ ...baseProduct, notaCompartida: "CAMBIO A" }], {
      observacion: "BASE",
    });
    sync.put("B", 7, [baseProduct], { observacion: "CAMBIO B" });
    sync.setUid("A");

    await sync.run();

    expect(sync.get("A", 7)?.productos[0]).toMatchObject({
      pId: "C",
      uCantidad: 2,
      notaCompartida: "CAMBIO A",
    });
    expect(sync.get("B", 7)?.datos).toEqual({ observacion: "CAMBIO B" });
  });

  it("propaga la eliminacion explicita de una propiedad de producto", async () => {
    const sync = fixture();
    const baseProduct = { ...product("C", 2), notaCompartida: "ANTERIOR" };
    sync.put("A", 7, [baseProduct], { cliente: "BASE" });
    await sync.run();
    sync.setUid("B");
    await sync.run();
    sync.put("A", 7, [product("C", 2)], { cliente: "BASE" });
    sync.put("B", 7, [baseProduct], { cliente: "CAMBIO B" });
    sync.setUid("A");

    await sync.run();

    expect(sync.get("A", 7)?.productos[0]).not.toHaveProperty("notaCompartida");
    expect(sync.get("B", 7)?.productos[0]).not.toHaveProperty("notaCompartida");
    expect(sync.get("A", 7)?.datos).toEqual({ cliente: "CAMBIO B" });
  });
});
