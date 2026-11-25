(function initializeVincularTabsCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasVincularTabs = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildVincularTabsCore() {
  "use strict";

  const STATE_KEY = "tmhVincularTabsState";
  const CONFIG_KEYS = Object.freeze([
    "tmhVincularTabsEnabled",
    "tmhVincularTabsStart",
    "tmhVincularTabsEnd",
  ]);

  function deepClone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function validateConfig(values) {
    const rawStart = values?.tmhVincularTabsStart;
    const rawEnd = values?.tmhVincularTabsEnd;
    if (
      rawStart === null ||
      rawStart === undefined ||
      rawStart === "" ||
      rawEnd === null ||
      rawEnd === undefined ||
      rawEnd === ""
    ) {
      return null;
    }
    const start = Number(rawStart);
    const end = Number(rawEnd);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start
    ) {
      return null;
    }
    return {
      enabled: values?.tmhVincularTabsEnabled === true,
      start,
      end,
    };
  }

  function sameProductLine(left, right) {
    return (
      left?.pId == right?.pId &&
      Number(left?.uIdInventario) === Number(right?.uIdInventario) &&
      (left?.uDetalle || "") === "" &&
      (right?.uDetalle || "") === "" &&
      (left?.uIdPromotion || 0) == (right?.uIdPromotion || 0) &&
      Number(left?.uMargenPrecio ?? 1) === Number(right?.uMargenPrecio ?? 1) &&
      Number(left?.uIdSeller || 0) === Number(right?.uIdSeller || 0) &&
      left?.consignedProduct !== true &&
      right?.consignedProduct !== true &&
      left?.uCierreMonto !== true &&
      right?.uCierreMonto !== true &&
      Math.round(Number(left?.uPrecio) * 100) ===
        Math.round(Number(right?.uPrecio) * 100)
    );
  }

  function mergeProducts(
    masterProducts = [],
    accountProducts = [],
    baseProducts = masterProducts,
  ) {
    const master = Array.isArray(masterProducts) ? masterProducts : [];
    const account = Array.isArray(accountProducts) ? accountProducts : [];
    const base = Array.isArray(baseProducts) ? baseProducts : [];
    const templates = [];
    for (const product of [...master, ...account]) {
      if (!templates.some((template) => sameConcurrentLine(template, product))) {
        templates.push(product);
      }
    }
    return templates.map((template) => {
      const baseProduct = base.find((product) =>
        sameConcurrentLine(product, template),
      );
      const masterProduct = master.find((product) =>
        sameConcurrentLine(product, template),
      );
      const accountProduct = account.find((product) =>
        sameConcurrentLine(product, template),
      );
      const merged = mergeConcurrentObject(
        baseProduct,
        [masterProduct, accountProduct].filter(Boolean),
        accountProduct || masterProduct,
        new Set(["uCantidad"]),
        true,
      );
      merged.uCantidad =
        lineQuantity(master, template) + lineQuantity(account, template);
      return merged;
    });
  }

  function mergeInitialRecord(masterRecord, accountRecord, baseRecord = masterRecord) {
    if (!masterRecord) return deepClone(accountRecord);
    if (!accountRecord) return deepClone(masterRecord);
    const merged = mergeConcurrentFields(
      baseRecord,
      [masterRecord, accountRecord],
      accountRecord,
    );
    merged.productos = mergeProducts(
      masterRecord.productos,
      accountRecord.productos,
      baseRecord?.productos,
    );
    return merged;
  }

  function concurrentLineKey(product) {
    const comparable = deepClone(product || {});
    delete comparable.uCantidad;
    return JSON.stringify(stableValue(comparable));
  }

  function sameConcurrentLine(left, right) {
    return (
      sameProductLine(left, right) ||
      concurrentLineKey(left) === concurrentLineKey(right)
    );
  }

  function lineQuantity(products, template) {
    return (Array.isArray(products) ? products : []).reduce(
      (total, product) =>
        sameConcurrentLine(product, template)
          ? total + Number(product.uCantidad || 0)
          : total,
      0,
    );
  }

  function sameValue(left, right) {
    return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function cloneOptional(value) {
    return value === undefined ? undefined : deepClone(value);
  }

  function assertCompatibleValues(values) {
    const defined = values.filter((value) => value !== undefined);
    if (defined.length <= 1) return;
    if (defined.every(isPlainObject)) {
      const keys = new Set();
      for (const value of defined) {
        for (const key of Object.keys(value)) keys.add(key);
      }
      for (const key of keys) {
        assertCompatibleValues(defined.map((value) => value[key]));
      }
      return;
    }
    const signatures = new Set(
      defined.map((value) => JSON.stringify(stableValue(value))),
    );
    if (signatures.size > 1) {
      throw new Error("Duplicados ambiguos en la misma TAB");
    }
  }

  function assertCompatibleObjects(records, ignoredKeys) {
    const keys = new Set();
    for (const record of records) {
      for (const key of Object.keys(record || {})) {
        if (!ignoredKeys.has(key)) keys.add(key);
      }
    }
    for (const key of keys) {
      assertCompatibleValues(records.map((record) => record?.[key]));
    }
  }

  function mergeConcurrentValue(baseValue, currentValues, preferredValue) {
    const changedValues = currentValues.filter(
      (value) => !sameValue(value, baseValue),
    );
    if (changedValues.length === 0) return cloneOptional(baseValue);

    const canMergeObjects =
      (baseValue === undefined || isPlainObject(baseValue)) &&
      changedValues.every(
        (value) => value === undefined || isPlainObject(value),
      );
    if (canMergeObjects) {
      const keys = new Set(Object.keys(baseValue || {}));
      for (const value of changedValues) {
        for (const key of Object.keys(value || {})) keys.add(key);
      }
      const merged = {};
      for (const key of keys) {
        const nextValue = mergeConcurrentValue(
          baseValue?.[key],
          currentValues.map((value) =>
            isPlainObject(value) ? value[key] : undefined,
          ),
          isPlainObject(preferredValue) ? preferredValue[key] : undefined,
        );
        if (nextValue !== undefined) merged[key] = nextValue;
      }
      return merged;
    }

    if (!sameValue(preferredValue, baseValue)) {
      return cloneOptional(preferredValue);
    }
    return cloneOptional(changedValues.at(-1));
  }

  function mergeConcurrentObject(
    baseRecord,
    currentRecords,
    preferredRecord,
    ignoredKeys,
    ignoreUndefined = false,
  ) {
    const outputSource = preferredRecord || baseRecord || currentRecords.find(Boolean);
    const merged = deepClone(outputSource);
    const keys = new Set();
    for (const record of [baseRecord, ...currentRecords, preferredRecord]) {
      for (const key of Object.keys(record || {})) {
        if (!ignoredKeys.has(key)) keys.add(key);
      }
    }
    for (const key of keys) {
      const currentValues = currentRecords.map((record) => record?.[key]);
      const preferredValue = preferredRecord?.[key];
      const nextValue = mergeConcurrentValue(
        baseRecord?.[key],
        ignoreUndefined
          ? currentValues.filter((value) => value !== undefined)
          : currentValues,
        ignoreUndefined && preferredValue === undefined
          ? baseRecord?.[key]
          : preferredValue,
      );
      if (nextValue === undefined) delete merged[key];
      else merged[key] = nextValue;
    }
    return merged;
  }

  function mergeConcurrentFields(baseRecord, currentRecords, preferredRecord) {
    return mergeConcurrentObject(
      baseRecord,
      currentRecords,
      preferredRecord,
      new Set(["id", "uidUser", "tab", "productos"]),
    );
  }

  function mergeConcurrentRecords(baseRecord, currentRecords, preferredRecord) {
    const records = currentRecords.map((record) => record || null);
    const outputSource = preferredRecord || baseRecord || records.find(Boolean);
    if (!outputSource) return null;
    const templates = [];
    for (const record of [baseRecord, ...records]) {
      for (const product of record?.productos || []) {
        if (!templates.some((template) => sameConcurrentLine(template, product))) {
          templates.push(deepClone(product));
        }
      }
    }

    const products = [];
    for (const template of templates) {
      const baseQuantity = lineQuantity(baseRecord?.productos, template);
      const quantity = records.reduce(
        (total, record) =>
          total + lineQuantity(record?.productos, template) - baseQuantity,
        baseQuantity,
      );
      if (quantity <= 0) continue;
      const baseProduct = baseRecord?.productos?.find((product) =>
        sameConcurrentLine(product, template),
      );
      const currentProducts = records
        .map((record) =>
          record?.productos?.find((product) =>
            sameConcurrentLine(product, template),
          ),
        )
        .filter(Boolean);
      const preferredProduct = preferredRecord?.productos?.find((product) =>
        sameConcurrentLine(product, template),
      );
      const mergedProduct = mergeConcurrentObject(
        baseProduct,
        currentProducts,
        preferredProduct || currentProducts[0] || baseProduct,
        new Set(["uCantidad"]),
      );
      mergedProduct.uCantidad = quantity;
      products.push(mergedProduct);
    }
    if (!preferredRecord && products.length === 0) return null;
    const merged = mergeConcurrentFields(baseRecord, records, preferredRecord);
    merged.productos = products;
    return merged;
  }

  function mergeDuplicateRecords(records) {
    const list = records.filter(Boolean);
    if (list.length === 0) return null;
    if (list.length === 1) return deepClone(list[0]);
    const preferred =
      list.find((record) => typeof record.tab === "number") || list[0];
    assertCompatibleObjects(
      list,
      new Set(["id", "uidUser", "tab", "productos"]),
    );
    const merged = mergeConcurrentObject(
      undefined,
      list,
      preferred,
      new Set(["id", "uidUser", "tab", "productos"]),
      true,
    );
    const templates = [];
    for (const record of list) {
      for (const product of record.productos || []) {
        if (!templates.some((template) => sameConcurrentLine(template, product))) {
          templates.push(product);
        }
      }
    }
    merged.productos = templates.map((template) => {
      const matches = list
        .map((record) =>
          record.productos?.find((product) =>
            sameConcurrentLine(product, template),
          ),
        )
        .filter(Boolean);
      const preferredProduct = preferred.productos?.find((product) =>
        sameConcurrentLine(product, template),
      );
      assertCompatibleObjects(matches, new Set());
      const product = mergeConcurrentObject(
        undefined,
        matches,
        preferredProduct || matches[0],
        new Set(["uCantidad"]),
        true,
      );
      product.uCantidad = Number(
        (preferredProduct || matches[0])?.uCantidad || 0,
      );
      return product;
    });
    return merged;
  }

  function mergeJoiningConflict(
    baseRecord,
    initializedRecords,
    joiningRecord,
  ) {
    const latestShared = mergeConcurrentRecords(
      baseRecord,
      initializedRecords,
      baseRecord,
    );
    return mergeInitialRecord(latestShared, joiningRecord, baseRecord);
  }

  function cloneForUser(record, uid, tab, existingRecord = null) {
    const cloned = deepClone(record);
    cloned.uidUser = String(uid);
    cloned.tab = Number(tab);
    if (existingRecord?.id !== undefined) cloned.id = existingRecord.id;
    else delete cloned.id;
    return cloned;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = stableValue(value[key]);
          return result;
        }, {});
    }
    return value;
  }

  function fingerprintRecord(record) {
    if (!record) return "null";
    const shared = deepClone(record);
    delete shared.id;
    delete shared.uidUser;
    shared.tab = Number(shared.tab);
    return JSON.stringify(stableValue(shared));
  }

  function normalizeState(value) {
    return {
      masters:
        value?.masters && typeof value.masters === "object"
          ? deepClone(value.masters)
          : {},
      initialized:
        value?.initialized && typeof value.initialized === "object"
          ? deepClone(value.initialized)
          : {},
      pending:
        value?.pending && typeof value.pending === "object"
          ? deepClone(value.pending)
          : null,
    };
  }

  function isInitialized(state, uid, tab) {
    return state.initialized?.[uid]?.[tab] === true;
  }

  function markInitialized(state, uid, tab) {
    state.initialized[uid] ||= {};
    state.initialized[uid][tab] = true;
  }

  function targetsForTab(state, tab, uid) {
    const targets = Object.keys(state.initialized).filter((candidate) =>
      isInitialized(state, candidate, tab),
    );
    if (!targets.includes(uid)) targets.push(uid);
    return targets;
  }

  function tabsToProcess(records, masters, start, end) {
    const tabs = new Set();
    for (const record of records) {
      const tab = Number(record?.tab);
      if (Number.isSafeInteger(tab) && tab >= start && tab <= end) tabs.add(tab);
    }
    for (const value of Object.keys(masters)) {
      const tab = Number(value);
      if (Number.isSafeInteger(tab) && tab >= start && tab <= end) tabs.add(tab);
    }
    return [...tabs].sort((left, right) => left - right);
  }

  function createOperationId() {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) {
      throw signal.reason || new Error("Sincronización cancelada");
    }
  }

  function createSyncController({
    storage,
    database,
    getContext,
    requestReload = () => {},
  }) {
    let activeRun = null;

    async function loadConfig(scopedStorage) {
      return validateConfig(await scopedStorage.get(CONFIG_KEYS));
    }

    function sameConfig(left, right) {
      return (
        left?.enabled === true &&
        right?.enabled === true &&
        left.start === right.start &&
        left.end === right.end
      );
    }

    async function saveState(state, scopedStorage) {
      await scopedStorage.set({ [STATE_KEY]: state });
    }

    function finalizePendingState(state, operation) {
      if (operation.record) state.masters[operation.tab] = operation.record;
      else delete state.masters[operation.tab];
      if (operation.initializeUid) {
        markInitialized(state, operation.initializeUid, operation.tab);
      }
      state.pending = null;
    }

    async function completePending(state, scopedStorage, signal) {
      throwIfAborted(signal);
      const operation = state.pending;
      if (!operation) return;
      const currentConfig = await loadConfig(scopedStorage);
      throwIfAborted(signal);
      const operationConfig = operation.config;
      const stillAllowed =
        sameConfig(currentConfig, operationConfig) &&
        operation.tab >= currentConfig.start &&
        operation.tab <= currentConfig.end;

      if (!stillAllowed) {
        const result = database.confirmOperation
          ? await database.confirmOperation(operation, signal)
          : await database.inspectOperation(operation, signal);
        throwIfAborted(signal);
        const status = typeof result === "string" ? result : result.status;
        if (result?.record !== undefined) operation.record = result.record;
        if (status === "already-applied") {
          finalizePendingState(state, operation);
          await saveState(state, scopedStorage);
          requestReload(operation.tab, operation.targets);
        } else {
          state.pending = null;
          await saveState(state, scopedStorage);
        }
        return;
      }

      const result = await database.applyOperation(operation, signal);
      throwIfAborted(signal);
      const status = typeof result === "string" ? result : result.status;
      if (result?.record !== undefined) operation.record = result.record;
      if (status === "conflict") {
        state.pending = null;
        await saveState(state, scopedStorage);
        return;
      }
      finalizePendingState(state, operation);
      await saveState(state, scopedStorage);
      requestReload(operation.tab, operation.targets);
    }

    async function queueOperation(
      state,
      operation,
      config,
      scopedStorage,
      signal,
    ) {
      throwIfAborted(signal);
      const latestConfig = await loadConfig(scopedStorage);
      throwIfAborted(signal);
      if (!sameConfig(latestConfig, config)) return false;
      state.pending = operation;
      await saveState(state, scopedStorage);
      throwIfAborted(signal);
      await completePending(state, scopedStorage, signal);
      return true;
    }

    function operationFor({
      state,
      tab,
      uid,
      current,
      master,
      record,
      initializeUid,
      config,
    }) {
      const targets = targetsForTab(state, tab, uid);
      return {
        operationId: createOperationId(),
        tab,
        record: record ? deepClone(record) : null,
        baseRecord: master ? deepClone(master) : null,
        targets,
        initializeUid: initializeUid || null,
        config: { enabled: true, start: config.start, end: config.end },
        expectedFingerprints: Object.fromEntries(
          targets.map((targetUid) => [
            targetUid,
            fingerprintRecord(targetUid === uid ? current : master),
          ]),
        ),
      };
    }

    async function execute(scopedStorage = storage, signal = null) {
      throwIfAborted(signal);
      const context = await getContext();
      throwIfAborted(signal);
      const uid = context?.uid ? String(context.uid) : "";
      if (!uid) return;
      const stored = await scopedStorage.get([...CONFIG_KEYS, STATE_KEY]);
      throwIfAborted(signal);
      const config = validateConfig(stored);
      if (!config?.enabled) return;

      const state = normalizeState(stored[STATE_KEY]);
      if (state.pending) {
        await completePending(state, scopedStorage, signal);
        return;
      }
      const durableState = database.getDurableState
        ? await database.getDurableState(config.start, config.end, signal)
        : [];
      throwIfAborted(signal);
      for (const entry of durableState || []) {
        const tab = Number(entry?.tab);
        if (
          !Number.isSafeInteger(tab) ||
          tab < config.start ||
          tab > config.end ||
          !Array.isArray(entry?.targets)
        ) {
          continue;
        }
        if (
          entry.record &&
          !Object.prototype.hasOwnProperty.call(state.masters, tab)
        ) {
          state.masters[tab] = deepClone(entry.record);
        }
        for (const targetUid of entry.targets) {
          if (targetUid !== null && targetUid !== undefined) {
            markInitialized(state, String(targetUid), tab);
          }
        }
      }
      const records = await database.getRecordsForUser(
        uid,
        config.start,
        config.end,
        signal,
      );
      throwIfAborted(signal);
      const recordsByTab = new Map();
      for (const record of records) {
        const tab = Number(record.tab);
        if (!recordsByTab.has(tab)) recordsByTab.set(tab, []);
        recordsByTab.get(tab).push(record);
      }
      const byTab = new Map(
        [...recordsByTab].map(([tab, matches]) => [
          tab,
          mergeDuplicateRecords(matches),
        ]),
      );
      for (const tab of tabsToProcess(
        records,
        state.masters,
        config.start,
        config.end,
      )) {
        const current = byTab.get(tab) || null;
        const master = state.masters[tab] || null;
        const initialized = isInitialized(state, uid, tab);

        if (!initialized) {
          if (!current && !master) continue;
          const shared = mergeInitialRecord(master, current);
          const targets = targetsForTab(state, tab, uid);
          if (master || targets.length > 1) {
            await queueOperation(
              state,
              operationFor({
                state,
                tab,
                uid,
                current,
                master,
                record: shared,
                initializeUid: uid,
                config,
              }),
              config,
              scopedStorage,
              signal,
            );
            return;
          }
          state.masters[tab] = deepClone(shared);
          markInitialized(state, uid, tab);
          await saveState(state, scopedStorage);
          continue;
        }

        if (!current && master) {
          await queueOperation(
            state,
            operationFor({
              state,
              tab,
              uid,
              current,
              master,
              record: null,
              initializeUid: null,
              config,
            }),
            config,
            scopedStorage,
            signal,
          );
          return;
        }

        if (current && fingerprintRecord(current) !== fingerprintRecord(master)) {
          await queueOperation(
            state,
            operationFor({
              state,
              tab,
              uid,
              current,
              master,
              record: current,
              initializeUid: null,
              config,
            }),
            config,
            scopedStorage,
            signal,
          );
          return;
        }
      }
    }

    function run(scopedStorage = storage, signal = null) {
      if (activeRun) return activeRun;
      activeRun = Promise.resolve(execute(scopedStorage, signal)).finally(() => {
        activeRun = null;
      });
      return activeRun;
    }

    return { run };
  }

  return {
    STATE_KEY,
    cloneForUser,
    createSyncController,
    fingerprintRecord,
    mergeDuplicateRecords,
    mergeInitialRecord,
    mergeJoiningConflict,
    mergeConcurrentRecords,
    mergeProducts,
    validateConfig,
  };
});
