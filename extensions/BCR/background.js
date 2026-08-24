importScripts('sync-core.js');

const {
  enqueueReceipts,
  getReadyRecords,
  markFailed,
  markSending,
  markSucceeded,
  normalizeApiBaseUrl,
  normalizeReceipt,
  resetErroredRecords,
  summarizeQueue,
} = globalThis.TimeMasterBcrSync;

const QUEUE_KEY = 'bcrSyncQueue';
const RECEIPTS_KEY = 'bcrCapturedReceipts';
const CONFIG_KEY = 'bcrIntegrationConfig';
const ALARM_NAME = 'tmBcrSync';
const DEFAULT_API_BASE_URL = 'https://www.timemaster.es';
const MAX_LOCAL_RECEIPTS = 1000;

let storageChain = Promise.resolve();
let flushPromise = null;

function runSerialized(task) {
  const result = storageChain.then(task, task);
  storageChain = result.catch(() => undefined);
  return result;
}

async function readQueue() {
  const result = await chrome.storage.local.get(QUEUE_KEY);
  const queue = result[QUEUE_KEY];
  return queue && typeof queue === 'object' && !Array.isArray(queue) ? queue : {};
}

async function writeQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

async function enqueueCapturedReceipts(receipts) {
  return runSerialized(async () => {
    const result = await chrome.storage.local.get([QUEUE_KEY, RECEIPTS_KEY]);
    const queue =
      result[QUEUE_KEY] &&
      typeof result[QUEUE_KEY] === 'object' &&
      !Array.isArray(result[QUEUE_KEY])
        ? result[QUEUE_KEY]
        : {};
    const currentReceipts = Array.isArray(result[RECEIPTS_KEY])
      ? result[RECEIPTS_KEY]
      : [];
    const next = enqueueReceipts(queue, receipts, Date.now());
    let nextReceipts = currentReceipts;
    for (const rawReceipt of Array.isArray(receipts) ? receipts : []) {
      const normalized = normalizeReceipt(rawReceipt);
      if (nextReceipts.some((receipt) => receipt.receiptId === normalized.receiptId)) {
        continue;
      }
      nextReceipts = [
        ...nextReceipts,
        {
          ...normalized,
          capturedAt: Number(rawReceipt?.capturedAt || Date.now()),
        },
      ];
    }
    nextReceipts = [...nextReceipts]
      .sort((left, right) => String(right.paidAt).localeCompare(String(left.paidAt)))
      .slice(0, MAX_LOCAL_RECEIPTS);
    await chrome.storage.local.set({
      [QUEUE_KEY]: next,
      [RECEIPTS_KEY]: nextReceipts,
    });
    return summarizeQueue(next);
  });
}

async function readConfiguration() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const stored = result[CONFIG_KEY] || {};
  return {
    apiBaseUrl: normalizeApiBaseUrl(stored.apiBaseUrl || DEFAULT_API_BASE_URL),
    token: typeof stored.token === 'string' ? stored.token.trim() : '',
  };
}

async function markRecordSending(record) {
  return runSerialized(async () => {
    const queue = await readQueue();
    const current = queue[record.receiptId];
    if (!current || current.revision !== record.revision) return false;
    const next = markSending(queue, record.receiptId, record.revision, Date.now());
    await writeQueue(next);
    return next[record.receiptId]?.state === 'sending';
  });
}

async function completeRecord(record, failure) {
  return runSerialized(async () => {
    const queue = await readQueue();
    const next = failure
      ? markFailed(queue, record.receiptId, record.revision, failure, Date.now())
      : markSucceeded(queue, record.receiptId, record.revision, Date.now());
    await writeQueue(next);
  });
}

async function sendRecord(record, configuration) {
  if (!(await markRecordSending(record))) return;
  try {
    const response = await fetch(
      `${configuration.apiBaseUrl}/api/integrations/bcr/receipts`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${configuration.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(record.payload),
        cache: 'no-store',
        credentials: 'omit',
      },
    );
    const body = await response.json().catch(() => null);
    if (response.ok && body?.ok === true) {
      await completeRecord(record, null);
      return;
    }
    await completeRecord(record, {
      status: response.status,
      message: typeof body?.error === 'string' ? body.error : response.statusText,
    });
  } catch (error) {
    await completeRecord(record, {
      status: 0,
      message: error instanceof Error ? error.message : 'network failure',
    });
  }
}

async function performFlush() {
  const configuration = await readConfiguration().catch(() => null);
  if (!configuration?.token) return;
  const queue = await runSerialized(readQueue);
  for (const record of getReadyRecords(queue, Date.now())) {
    await sendRecord(record, configuration);
  }
}

function flushQueue() {
  if (!flushPromise) {
    flushPromise = performFlush()
      .catch((error) => console.error('[TimeMaster BCR] Error sincronizando:', error))
      .finally(() => { flushPromise = null; });
  }
  return flushPromise;
}

async function resetErrorsAfterConfigurationChange() {
  await runSerialized(async () => {
    const queue = await readQueue();
    await writeQueue(resetErroredRecords(queue, Date.now()));
  });
}

async function getPublicStatus() {
  const [queue, configuration] = await Promise.all([
    runSerialized(readQueue),
    readConfiguration().catch(() => ({ token: '', apiBaseUrl: '' })),
  ]);
  return {
    ok: true,
    configured: Boolean(configuration.token),
    apiBaseUrl: configuration.apiBaseUrl,
    queue: summarizeQueue(queue),
  };
}

function ensureAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); void flushQueue(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); void flushQueue(); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void flushQueue();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'TM_BCR_QUEUE_RECEIPTS') {
    enqueueCapturedReceipts(message.receipts)
      .then((queue) => {
        sendResponse({ ok: true, queue });
        void flushQueue();
      })
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }
  if (message?.type === 'TM_BCR_CONFIG_UPDATED') {
    resetErrorsAfterConfigurationChange()
      .then(() => {
        sendResponse({ ok: true });
        void flushQueue();
      })
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }
  if (message?.type === 'TM_BCR_SYNC_STATUS') {
    getPublicStatus().then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) });
    });
    return true;
  }
});

ensureAlarm();
void flushQueue();
