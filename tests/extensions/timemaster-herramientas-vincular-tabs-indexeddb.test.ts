import { createRequire } from "node:module";
import { resolve } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const runtime = requireModule(
  resolve(
    process.cwd(),
    "extensions/TimeMasterHerramientas/vinculartabs-content.js",
  ),
);
const core = requireModule(
  resolve(
    process.cwd(),
    "extensions/TimeMasterHerramientas/vinculartabs-core.js",
  ),
);

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolveRequest, rejectRequest) => {
    request.onsuccess = () => resolveRequest(request.result);
    request.onerror = () => rejectRequest(request.error);
  });
}

describe("TimeMasterHerramientas vinculación con IndexedDB de Contica", () => {
  it("no crea una base vacía cuando Contica todavía no existe", async () => {
    const indexedDB = new IDBFactory();
    const adapter = runtime.createIndexedDbAdapter(indexedDB);

    await expect(adapter.getRecordsForUser("A", 1, 20)).rejects.toThrow();

    const databases = await indexedDB.databases();
    expect(databases.some((item) => item.name === runtime.DATABASE_NAME)).toBe(
      false,
    );
  });

  it("conserva el id por cuenta y crea la copia faltante en la misma TAB", async () => {
    const indexedDB = new IDBFactory();
    const open = indexedDB.open(runtime.DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(runtime.STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("uidUser", "uidUser", { unique: false });
    };
    const database = await requestResult(open);
    const seed = database
      .transaction(runtime.STORE_NAME, "readwrite")
      .objectStore(runtime.STORE_NAME)
      .add({ uidUser: "A", tab: 7, productos: [], datos: { cliente: "uno" } });
    const originalId = await requestResult(seed);
    database.close();

    const adapter = runtime.createIndexedDbAdapter(indexedDB);
    await adapter.replaceForUsers(
      7,
      { uidUser: "A", tab: 7, productos: [], datos: { cliente: "compartido" } },
      ["A", "B"],
    );

    const accountA = await adapter.getRecordsForUser("A", 7, 7);
    const accountB = await adapter.getRecordsForUser("B", 7, 7);
    expect(accountA).toHaveLength(1);
    expect(accountA[0]).toMatchObject({
      id: originalId,
      uidUser: "A",
      tab: 7,
      datos: { cliente: "compartido" },
    });
    expect(accountB).toHaveLength(1);
    expect(accountB[0]).toMatchObject({
      uidUser: "B",
      tab: 7,
      datos: { cliente: "compartido" },
    });
    expect(accountB[0].id).not.toBe(originalId);
  });

  it("deduplica TAB numérica/string y conserva recibo de la operación", async () => {
    const indexedDB = new IDBFactory();
    const open = indexedDB.open(runtime.DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(runtime.STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("uidUser", "uidUser", { unique: false });
    };
    const database = await requestResult(open);
    const store = database
      .transaction(runtime.STORE_NAME, "readwrite")
      .objectStore(runtime.STORE_NAME);
    const recordA = {
      uidUser: "A",
      tab: 7,
      productos: [{ pId: "C", uIdInventario: 1, uCantidad: 2, uPrecio: 100 }],
      datos: {},
    };
    const recordB = {
      uidUser: "B",
      tab: "7",
      productos: [{ pId: "C", uIdInventario: 1, uCantidad: 3, uPrecio: 100 }],
      datos: {},
    };
    await requestResult(store.add(recordA));
    await requestResult(store.add(recordB));
    await requestResult(store.add({ ...recordB, tab: 7 }));
    database.close();
    const adapter = runtime.createIndexedDbAdapter(indexedDB);
    const operation = {
      operationId: "operation-1",
      tab: 7,
      record: {
        ...recordB,
        tab: 7,
        productos: [
          { pId: "C", uIdInventario: 1, uCantidad: 5, uPrecio: 100 },
        ],
      },
      targets: ["A", "B"],
      expectedFingerprints: {
        A: core.fingerprintRecord(recordA),
        B: core.fingerprintRecord(recordB),
      },
    };

    await expect(adapter.applyOperation(operation)).resolves.toBe("applied");
    const accountB = await adapter.getRecordsForUser("B", 7, 7);
    expect(accountB).toHaveLength(1);
    expect(accountB[0].productos[0].uCantidad).toBe(5);

    await adapter.replaceForUsers(
      7,
      {
        ...recordB,
        tab: 7,
        productos: [
          { pId: "C", uIdInventario: 1, uCantidad: 6, uPrecio: 100 },
        ],
      },
      ["B"],
    );
    await expect(adapter.inspectOperation(operation)).resolves.toBe(
      "already-applied",
    );
  });

  it("reconcilia duplicados divergentes sin perder productos", async () => {
    const indexedDB = new IDBFactory();
    const open = indexedDB.open(runtime.DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(runtime.STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("uidUser", "uidUser", { unique: false });
    };
    const database = await requestResult(open);
    const store = database
      .transaction(runtime.STORE_NAME, "readwrite")
      .objectStore(runtime.STORE_NAME);
    const recordA = {
      uidUser: "A",
      tab: 7,
      productos: [{ pId: "A", uIdInventario: 1, uCantidad: 1, uPrecio: 100 }],
      datos: {},
    };
    const recordBString = {
      uidUser: "B",
      tab: "7",
      productos: [
        { pId: "B-string", uIdInventario: 1, uCantidad: 1, uPrecio: 100 },
      ],
      datos: {},
    };
    const recordBNumber = {
      uidUser: "B",
      tab: 7,
      productos: [
        { pId: "B-number", uIdInventario: 1, uCantidad: 1, uPrecio: 100 },
      ],
      datos: {},
    };
    await requestResult(store.add(recordA));
    await requestResult(store.add(recordBString));
    await requestResult(store.add(recordBNumber));
    database.close();

    const adapter = runtime.createIndexedDbAdapter(indexedDB);
    const reconciledB = core.mergeDuplicateRecords([
      recordBString,
      recordBNumber,
    ]);
    const shared = core.mergeInitialRecord(recordA, reconciledB);
    const operation = {
      operationId: "divergent-duplicates",
      tab: 7,
      record: shared,
      baseRecord: recordA,
      initializeUid: "B",
      targets: ["A", "B"],
      expectedFingerprints: {
        A: core.fingerprintRecord(recordA),
        B: core.fingerprintRecord(reconciledB),
      },
    };

    await expect(adapter.applyOperation(operation)).resolves.toBe("applied");
    const accountA = await adapter.getRecordsForUser("A", 7, 7);
    const accountB = await adapter.getRecordsForUser("B", 7, 7);
    expect(accountB).toHaveLength(1);
    expect(accountA[0].productos.map((item: { pId: string }) => item.pId)).toEqual(
      ["A", "B-string", "B-number"],
    );
    expect(accountB[0].productos.map((item: { pId: string }) => item.pId)).toEqual(
      ["A", "B-string", "B-number"],
    );
  });

  it("detiene duplicados ambiguos sin borrar ninguna version", async () => {
    const indexedDB = new IDBFactory();
    const open = indexedDB.open(runtime.DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(runtime.STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("uidUser", "uidUser", { unique: false });
    };
    const database = await requestResult(open);
    const store = database
      .transaction(runtime.STORE_NAME, "readwrite")
      .objectStore(runtime.STORE_NAME);
    const stringRecord = {
      uidUser: "B",
      tab: "7",
      productos: [{ pId: "X", uIdInventario: 1, uCantidad: 3, uPrecio: 100 }],
      datos: { cliente: "MISMO" },
    };
    const numberRecord = {
      ...stringRecord,
      tab: 7,
      productos: [{ pId: "X", uIdInventario: 1, uCantidad: 4, uPrecio: 100 }],
    };
    await requestResult(store.add(stringRecord));
    await requestResult(store.add(numberRecord));
    database.close();

    const adapter = runtime.createIndexedDbAdapter(indexedDB);
    const operation = {
      operationId: "ambiguous-duplicates",
      tab: 7,
      record: numberRecord,
      baseRecord: numberRecord,
      targets: ["B"],
      expectedFingerprints: { B: core.fingerprintRecord(numberRecord) },
    };

    await expect(adapter.applyOperation(operation)).rejects.toThrow(
      "Duplicados ambiguos",
    );
    const untouched = await adapter.getRecordsForUser("B", 7, 7);
    expect(untouched).toHaveLength(2);
    expect(
      untouched
        .map(
          (record: { productos: Array<{ uCantidad: number }> }) =>
            record.productos[0].uCantidad,
        )
        .sort(),
    ).toEqual([3, 4]);
  });

  it("actualiza el recibo durable cuando una TAB ya fue borrada", async () => {
    const indexedDB = new IDBFactory();
    const open = indexedDB.open(runtime.DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(runtime.STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("uidUser", "uidUser", { unique: false });
    };
    const database = await requestResult(open);
    database.close();
    const adapter = runtime.createIndexedDbAdapter(indexedDB);
    const operation = {
      operationId: "durable-tombstone",
      tab: 7,
      record: null,
      baseRecord: {
        uidUser: "A",
        tab: 7,
        productos: [{ pId: "C", uIdInventario: 1, uCantidad: 5, uPrecio: 100 }],
        datos: {},
      },
      targets: ["A", "B"],
      expectedFingerprints: { A: "null", B: "null" },
    };

    await expect(adapter.applyOperation(operation)).resolves.toBe(
      "already-applied",
    );
    await expect(adapter.getDurableState(7, 7)).resolves.toEqual([
      { tab: 7, record: null, targets: ["A", "B"] },
    ]);

    await expect(
      adapter.confirmOperation({
        ...operation,
        operationId: "durable-tombstone-confirmed",
        targets: ["A", "B", "C"],
        expectedFingerprints: { A: "null", B: "null", C: "null" },
      }),
    ).resolves.toBe("already-applied");
    await expect(adapter.getDurableState(7, 7)).resolves.toEqual([
      { tab: 7, record: null, targets: ["A", "B", "C"] },
    ]);
  });

  it("conserva una edicion concurrente mientras una cuenta se vincula", async () => {
    const indexedDB = new IDBFactory();
    const open = indexedDB.open(runtime.DATABASE_NAME, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(runtime.STORE_NAME, {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex("uidUser", "uidUser", { unique: false });
    };
    const database = await requestResult(open);
    const store = database
      .transaction(runtime.STORE_NAME, "readwrite")
      .objectStore(runtime.STORE_NAME);
    const baseA = {
      uidUser: "A",
      tab: 7,
      productos: [
        {
          pId: "C",
          uIdInventario: 1,
          uCantidad: 2,
          uPrecio: 100,
          notaCompartida: "BASE",
        },
      ],
      datos: { cliente: "ORIGINAL" },
    };
    const currentA = {
      ...baseA,
      productos: [
        {
          ...baseA.productos[0],
          uCantidad: 4,
          notaCompartida: "ACTUALIZADA",
        },
      ],
      datos: { cliente: "ACTUALIZADO" },
    };
    const currentB = {
      ...baseA,
      uidUser: "B",
      productos: [{ pId: "C", uIdInventario: 1, uCantidad: 3, uPrecio: 100 }],
    };
    await requestResult(store.add(currentA));
    await requestResult(store.add(currentB));
    database.close();

    const adapter = runtime.createIndexedDbAdapter(indexedDB);
    const operation = {
      operationId: "joining-conflict",
      tab: 7,
      record: {
        ...baseA,
        productos: [{ pId: "C", uIdInventario: 1, uCantidad: 5, uPrecio: 100 }],
      },
      baseRecord: baseA,
      initializeUid: "B",
      targets: ["A", "B"],
      expectedFingerprints: {
        A: core.fingerprintRecord(baseA),
        B: core.fingerprintRecord(currentB),
      },
    };

    await expect(adapter.applyOperation(operation)).resolves.toMatchObject({
      status: "merged",
    });
    const accountA = await adapter.getRecordsForUser("A", 7, 7);
    const accountB = await adapter.getRecordsForUser("B", 7, 7);
    expect(accountA[0].productos[0].uCantidad).toBe(7);
    expect(accountB[0].productos[0].uCantidad).toBe(7);
    expect(accountA[0].productos[0].notaCompartida).toBe("ACTUALIZADA");
    expect(accountB[0].datos).toEqual({ cliente: "ACTUALIZADO" });
    await expect(adapter.getDurableState(7, 7)).resolves.toMatchObject([
      {
        tab: 7,
        targets: ["A", "B"],
        record: {
          productos: [expect.objectContaining({ pId: "C", uCantidad: 7 })],
        },
      },
    ]);

    await expect(adapter.applyOperation(operation)).resolves.toMatchObject({
      status: "already-applied",
      record: {
        productos: [expect.objectContaining({ pId: "C", uCantidad: 7 })],
      },
    });
  });
});
