/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeVincularTabsContent(root, factory) {
  const core =
    typeof module === "object" && module.exports
      ? require("./vinculartabs-core.js")
      : root.TimeMasterHerramientasVincularTabs;
  const api = factory(core);
  root.TimeMasterHerramientasVincularTabsContent = api;
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (root.chrome?.storage?.local && root.indexedDB) {
    api.createBrowserController(root).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContent(core) {
  "use strict";

  const DATABASE_NAME = "6f5d0c5a5b75464f8005dbe96f9657ce";
  const STORE_NAME = "pos";
  const CONTEXT_SOURCE = "tmh-vincular-tabs-page";
  const COMMAND_SOURCE = "tmh-vincular-tabs-extension";
  const CHANNEL_NAME = "tmh-vincular-tabs-reload-v1";
  const LOCK_PORT = "tmh-vincular-tabs-lock";
  const RECEIPT_UID = "__tmh_vincular_tabs_receipt__";

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Error de IndexedDB"));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("Error de IndexedDB"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("IndexedDB cancelado"));
    });
  }

  function abortTransactionOnSignal(transaction, signal) {
    if (!signal) return () => {};
    const abort = () => {
      try {
        transaction.abort();
      } catch {}
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    return () => signal.removeEventListener("abort", abort);
  }

  async function openDatabase(indexedDb) {
    if (typeof indexedDb.databases === "function") {
      const databases = await indexedDb.databases();
      if (!databases.some((item) => item.name === DATABASE_NAME)) {
        throw new Error("Base de datos de Contica no encontrada");
      }
    }
    return new Promise((resolve, reject) => {
      const request = indexedDb.open(DATABASE_NAME);
      request.onupgradeneeded = () => {
        try {
          request.transaction?.abort();
        } catch {}
      };
      request.onsuccess = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.close();
          reject(new Error("Almacén POS de Contica no encontrado"));
          return;
        }
        resolve(database);
      };
      request.onerror = () =>
        reject(request.error || new Error("Base de datos de Contica no encontrada"));
    });
  }

  function matchesUserTab(record, uid, tab) {
    return (
      String(record?.uidUser) === String(uid) &&
      Number(record?.tab) === Number(tab)
    );
  }

  function preferredRecord(records) {
    return records.find((record) => typeof record.tab === "number") || records[0];
  }

  async function loadOperationMatches(index, operation) {
    const matches = new Map();
    for (const uid of operation.targets) {
      const records = await requestResult(index.getAll(String(uid)));
      matches.set(
        uid,
        records.filter((record) => matchesUserTab(record, uid, operation.tab)),
      );
    }
    return matches;
  }

  async function loadReceiptMatches(index, tab) {
    const records = await requestResult(index.getAll(RECEIPT_UID));
    return records.filter((record) => Number(record?.tab) === Number(tab));
  }

  function recordsMatchFingerprint(records, fingerprint) {
    if (fingerprint === "null") return records.length === 0;
    return (
      records.length > 0 &&
      core.fingerprintRecord(core.mergeDuplicateRecords(records)) === fingerprint
    );
  }

  function operationStatus(matches, operation, receipts = []) {
    if (
      receipts.some(
        (receipt) => receipt?.tmhVincularTabsOperationId === operation.operationId,
      )
    ) {
      return "already-applied";
    }
    const desiredFingerprint = core.fingerprintRecord(operation.record);
    const alreadyApplied = operation.targets.every((uid) => {
      const records = matches.get(uid) || [];
      return (
        records.length <= 1 &&
        core.fingerprintRecord(preferredRecord(records)) === desiredFingerprint
      );
    });
    if (alreadyApplied) return "already-applied";

    const expected = operation.targets.every((uid) => {
      const records = matches.get(uid) || [];
      return recordsMatchFingerprint(
        records,
        operation.expectedFingerprints[uid],
      );
    });
    return expected ? "ready" : "conflict";
  }

  function resultWithReceipt(status, operation, receipts) {
    const receipt = receipts.find(
      (candidate) =>
        candidate?.tmhVincularTabsOperationId === operation.operationId,
    );
    if (
      status === "already-applied" &&
      receipt &&
      core.fingerprintRecord(receipt.tmhVincularTabsRecord) !==
        core.fingerprintRecord(operation.record)
    ) {
      return {
        status,
        record: receipt.tmhVincularTabsRecord ?? null,
      };
    }
    return status;
  }

  function writeOperationReceipt(store, receipts, operation, record) {
    const existingReceipt = preferredRecord(receipts);
    const receipt = {
      uidUser: RECEIPT_UID,
      tab: Number(operation.tab),
      datos: {},
      originalQuoteQuantities: {},
      productos: [],
      syncId: operation.operationId,
      tmhVincularTabsReceipt: true,
      tmhVincularTabsOperationId: operation.operationId,
      tmhVincularTabsRecord: record,
      tmhVincularTabsTargets: [...operation.targets],
    };
    if (existingReceipt?.id !== undefined) receipt.id = existingReceipt.id;
    store.put(receipt);
    for (const duplicate of receipts) {
      if (!existingReceipt || duplicate.id !== existingReceipt.id) {
        store.delete(duplicate.id);
      }
    }
  }

  function createIndexedDbAdapter(indexedDb) {
    return {
      async getDurableState(start, end, signal) {
        const database = await openDatabase(indexedDb);
        let detachAbort = () => {};
        try {
          const transaction = database.transaction(STORE_NAME, "readonly");
          const done = transactionDone(transaction);
          detachAbort = abortTransactionOnSignal(transaction, signal);
          const receipts = await requestResult(
            transaction
              .objectStore(STORE_NAME)
              .index("uidUser")
              .getAll(RECEIPT_UID),
          );
          await done;
          return receipts
            .filter((receipt) => {
              const tab = Number(receipt?.tab);
              return (
                receipt?.tmhVincularTabsReceipt === true &&
                tab >= start &&
                tab <= end &&
                Array.isArray(receipt?.tmhVincularTabsTargets)
              );
            })
            .map((receipt) => ({
              tab: Number(receipt.tab),
              record: receipt.tmhVincularTabsRecord ?? null,
              targets: receipt.tmhVincularTabsTargets.map(String),
            }));
        } finally {
          detachAbort();
          database.close();
        }
      },

      async getRecordsForUser(uid, start, end, signal) {
        const database = await openDatabase(indexedDb);
        let detachAbort = () => {};
        try {
          const transaction = database.transaction(STORE_NAME, "readonly");
          const done = transactionDone(transaction);
          detachAbort = abortTransactionOnSignal(transaction, signal);
          const records = await requestResult(
            transaction
              .objectStore(STORE_NAME)
              .index("uidUser")
              .getAll(String(uid)),
          );
          await done;
          return records.filter((record) => {
            const tab = Number(record?.tab);
            return tab >= start && tab <= end;
          });
        } finally {
          detachAbort();
          database.close();
        }
      },

      async replaceForUsers(tab, sharedRecord, users) {
        const database = await openDatabase(indexedDb);
        try {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const done = transactionDone(transaction);
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index("uidUser");

          for (const uid of users) {
            const userRecords = await requestResult(index.getAll(String(uid)));
            const matches = userRecords.filter((record) =>
              matchesUserTab(record, uid, tab),
            );
            if (!sharedRecord) {
              for (const record of matches) store.delete(record.id);
              continue;
            }
            const existing = preferredRecord(matches);
            store.put(core.cloneForUser(sharedRecord, uid, tab, existing));
            for (const duplicate of matches) {
              if (!existing || duplicate.id !== existing.id) {
                store.delete(duplicate.id);
              }
            }
          }
          await done;
        } finally {
          database.close();
        }
      },

      async inspectOperation(operation, signal) {
        const database = await openDatabase(indexedDb);
        let detachAbort = () => {};
        try {
          const transaction = database.transaction(STORE_NAME, "readonly");
          const done = transactionDone(transaction);
          detachAbort = abortTransactionOnSignal(transaction, signal);
          const index = transaction.objectStore(STORE_NAME).index("uidUser");
          const matches = await loadOperationMatches(index, operation);
          const receipts = await loadReceiptMatches(index, operation.tab);
          await done;
          const status = operationStatus(matches, operation, receipts);
          return resultWithReceipt(status, operation, receipts);
        } finally {
          detachAbort();
          database.close();
        }
      },

      async confirmOperation(operation, signal) {
        const database = await openDatabase(indexedDb);
        let detachAbort = () => {};
        try {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const done = transactionDone(transaction);
          detachAbort = abortTransactionOnSignal(transaction, signal);
          const store = transaction.objectStore(STORE_NAME);
          const matches = await loadOperationMatches(
            store.index("uidUser"),
            operation,
          );
          const receipts = await loadReceiptMatches(
            store.index("uidUser"),
            operation.tab,
          );
          const status = operationStatus(matches, operation, receipts);
          const result = resultWithReceipt(status, operation, receipts);
          if (status === "already-applied" && typeof result === "string") {
            writeOperationReceipt(store, receipts, operation, operation.record);
          }
          await done;
          return result;
        } finally {
          detachAbort();
          database.close();
        }
      },

      async applyOperation(operation, signal) {
        const database = await openDatabase(indexedDb);
        let detachAbort = () => {};
        try {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const done = transactionDone(transaction);
          detachAbort = abortTransactionOnSignal(transaction, signal);
          const store = transaction.objectStore(STORE_NAME);
          const matches = await loadOperationMatches(
            store.index("uidUser"),
            operation,
          );
          const receipts = await loadReceiptMatches(
            store.index("uidUser"),
            operation.tab,
          );
          const status = operationStatus(matches, operation, receipts);
          if (status === "already-applied") {
            const result = resultWithReceipt(status, operation, receipts);
            if (typeof result === "string") {
              writeOperationReceipt(store, receipts, operation, operation.record);
            }
            await done;
            return result;
          }
          let appliedRecord = operation.record;
          if (status === "conflict") {
            appliedRecord = operation.initializeUid
              ? core.mergeJoiningConflict(
                  operation.baseRecord,
                  operation.targets
                    .filter((uid) => uid !== operation.initializeUid)
                    .map((uid) =>
                      core.mergeDuplicateRecords(matches.get(uid) || []),
                    ),
                  core.mergeDuplicateRecords(
                    matches.get(operation.initializeUid) || [],
                  ),
                )
              : core.mergeConcurrentRecords(
                  operation.baseRecord,
                  operation.targets.map((uid) =>
                    core.mergeDuplicateRecords(matches.get(uid) || []),
                  ),
                  operation.record,
                );
          }

          for (const uid of operation.targets) {
            const records = matches.get(uid) || [];
            if (!appliedRecord) {
              for (const record of records) store.delete(record.id);
              continue;
            }
            const existing = preferredRecord(records);
            store.put(
              core.cloneForUser(
                appliedRecord,
                uid,
                operation.tab,
                existing,
              ),
            );
            for (const duplicate of records) {
              if (!existing || duplicate.id !== existing.id) {
                store.delete(duplicate.id);
              }
            }
          }
          writeOperationReceipt(store, receipts, operation, appliedRecord);
          await done;
          return status === "conflict"
            ? { status: "merged", record: appliedRecord }
            : "applied";
        } finally {
          detachAbort();
          database.close();
        }
      },
    };
  }

  function chromeStorage(chromeApi) {
    return {
      get(keys) {
        return new Promise((resolve, reject) => {
          chromeApi.storage.local.get(keys, (value) => {
            if (chromeApi.runtime.lastError) reject(chromeApi.runtime.lastError);
            else resolve(value || {});
          });
        });
      },
      set(values) {
        return new Promise((resolve, reject) => {
          chromeApi.storage.local.set(values, () => {
            if (chromeApi.runtime.lastError) reject(chromeApi.runtime.lastError);
            else resolve();
          });
        });
      },
    };
  }

  function createPortLock(runtime) {
    return (task) =>
      new Promise((resolve, reject) => {
        const port = runtime.connect({ name: LOCK_PORT });
        const abortController = new AbortController();
        const pendingRequests = new Map();
        let requestId = 1;
        let granted = false;
        let settled = false;

        function storageRequest(type, payload) {
          return new Promise((requestResolve, requestReject) => {
            const id = requestId++;
            pendingRequests.set(id, {
              resolve: requestResolve,
              reject: requestReject,
            });
            port.postMessage({ type, requestId: id, ...payload });
          });
        }

        const lockedStorage = {
          get: (keys) => storageRequest("storage-get", { keys }),
          set: (values) => storageRequest("storage-set", { values }),
        };

        port.onDisconnect.addListener(() => {
          if (settled) return;
          const error = new Error("Coordinador de vinculación desconectado");
          abortController.abort(error);
          for (const request of pendingRequests.values()) request.reject(error);
          pendingRequests.clear();
          settled = true;
          reject(error);
        });
        port.onMessage.addListener(async (message) => {
          if (message?.type === "storage-response") {
            const request = pendingRequests.get(message.requestId);
            if (!request) return;
            pendingRequests.delete(message.requestId);
            if (message.ok) request.resolve(message.value);
            else request.reject(new Error(message.error || "Error de almacenamiento"));
            return;
          }
          if (message?.type !== "granted" || granted) return;
          granted = true;
          try {
            const value = await task({
              storage: lockedStorage,
              signal: abortController.signal,
            });
            if (settled) return;
            port.postMessage({ type: "release" });
            settled = true;
            resolve(value);
          } catch (error) {
            if (!settled) {
              try {
                port.postMessage({ type: "release" });
              } catch {}
              settled = true;
              reject(error);
            }
          } finally {
            try {
              port.disconnect();
            } catch {}
          }
        });
      });
  }

  function createBrowserController(environment) {
    let context = null;
    let intervalId = null;
    let started = false;
    const channel =
      typeof environment.BroadcastChannel === "function"
        ? new environment.BroadcastChannel(CHANNEL_NAME)
        : null;

    function reloadIfActive(message) {
      if (!context?.uid || !Array.isArray(message?.targets)) return;
      if (!message.targets.includes(context.uid)) return;
      if (Number(message.tab) !== Number(context.currentTab)) return;
      environment.postMessage(
        { source: COMMAND_SOURCE, type: "reload", tab: message.tab },
        "*",
      );
    }

    const sync = core.createSyncController({
      storage: chromeStorage(environment.chrome),
      database: createIndexedDbAdapter(environment.indexedDB),
      getContext: () => context,
      requestReload(tab, targets) {
        const message = { tab, targets };
        reloadIfActive(message);
        channel?.postMessage(message);
      },
    });
    const withCoordinatorLock = createPortLock(environment.chrome.runtime);

    function handleMessage(event) {
      if (
        event.source !== environment ||
        event.data?.source !== CONTEXT_SOURCE
      ) {
        return;
      }
      context = {
        uid: event.data.uid ? String(event.data.uid) : "",
        currentTab: Number(event.data.currentTab),
      };
    }

    async function run() {
      try {
        await withCoordinatorLock(({ storage, signal }) =>
          sync.run(storage, signal),
        );
      } catch (error) {
        environment.console?.error("TimeMaster vinculación de TABs:", error);
      }
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      if (
        ![
          "tmhVincularTabsEnabled",
          "tmhVincularTabsStart",
          "tmhVincularTabsEnd",
        ].some((key) => changes?.[key])
      ) {
        return;
      }
      run();
    }

    function start() {
      if (started) return;
      started = true;
      environment.addEventListener("message", handleMessage);
      environment.chrome.storage.onChanged.addListener(handleStorageChange);
      if (channel) channel.onmessage = (event) => reloadIfActive(event.data);
      intervalId = environment.setInterval(run, 800);
      run();
    }

    function stop() {
      if (!started) return;
      started = false;
      environment.removeEventListener("message", handleMessage);
      environment.chrome.storage.onChanged.removeListener(handleStorageChange);
      if (intervalId !== null) environment.clearInterval(intervalId);
      intervalId = null;
      channel?.close();
    }

    return { run, start, stop };
  }

  return {
    CHANNEL_NAME,
    COMMAND_SOURCE,
    CONTEXT_SOURCE,
    DATABASE_NAME,
    STORE_NAME,
    createBrowserController,
    createIndexedDbAdapter,
    createPortLock,
  };
});
