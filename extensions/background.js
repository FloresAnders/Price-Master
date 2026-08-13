importScripts('sync-core.js');

const {
  enqueueEvents,
  getReadyRecords,
  markFailed,
  markSending,
  markSucceeded,
  normalizeApiBaseUrl,
  resetErroredRecords,
  summarizeQueue,
} = globalThis.TimeMasterGenteCrystalSync;

const QUEUE_KEY = 'genteCrystalSyncQueue';
const CONFIG_KEY = 'genteCrystalIntegrationConfig';
const ALARM_NAME = 'tmGcSync';
const DEFAULT_API_BASE_URL = 'https://timemaster.es';

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

async function enqueueSales(events) {
  return runSerialized(async () => {
    const queue = await readQueue();
    const next = enqueueEvents(queue, events, Date.now());
    await writeQueue(next);
    return summarizeQueue(next);
  });
}

async function readConfiguration() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const stored = result[CONFIG_KEY] || {};
  const token = typeof stored.token === 'string' ? stored.token.trim() : '';
  const apiBaseUrl = normalizeApiBaseUrl(
    stored.apiBaseUrl || DEFAULT_API_BASE_URL,
  );
  return { apiBaseUrl, token };
}

async function markRecordSending(record) {
  return runSerialized(async () => {
    const queue = await readQueue();
    const current = queue[record.ticketId];
    if (!current || current.revision !== record.revision) return false;
    const next = markSending(
      queue,
      record.ticketId,
      record.revision,
      Date.now(),
    );
    await writeQueue(next);
    return next[record.ticketId]?.state === 'sending';
  });
}

async function completeRecord(record, failure) {
  return runSerialized(async () => {
    const queue = await readQueue();
    const next = failure
      ? markFailed(
          queue,
          record.ticketId,
          record.revision,
          failure,
          Date.now(),
        )
      : markSucceeded(
          queue,
          record.revision,
          record.ticketId,
          Date.now(),
        );
    await writeQueue(next);
  });
}

async function sendRecord(record, configuration) {
  if (!(await markRecordSending(record))) return;

  try {
    const response = await fetch(
      `${configuration.apiBaseUrl}/api/integrations/gente-crystal/sales`,
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

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch (_error) {
      responseBody = null;
    }

    if (response.ok && responseBody?.ok === true) {
      await completeRecord(record, null);
      return;
    }

    await completeRecord(record, {
      status: response.status,
      message:
        typeof responseBody?.error === 'string'
          ? responseBody.error
          : response.statusText,
    });
  } catch (error) {
    await completeRecord(record, {
      status: 0,
      message: error instanceof Error ? error.message : 'network failure',
    });
  }
}

async function performFlush() {
  let configuration;
  try {
    configuration = await readConfiguration();
  } catch (error) {
    console.warn('[TimeMaster] ConfiguraciÃ³n de sincronizaciÃ³n invÃ¡lida.');
    return;
  }
  if (!configuration.token) return;

  const queue = await runSerialized(readQueue);
  const ready = getReadyRecords(queue, Date.now());
  for (const record of ready) {
    await sendRecord(record, configuration);
  }
}

function flushQueue() {
  if (!flushPromise) {
    flushPromise = performFlush()
      .catch((error) => {
        console.error('[TimeMaster] Error sincronizando la cola:', error);
      })
      .finally(() => {
        flushPromise = null;
      });
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

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  void flushQueue();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  void flushQueue();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void flushQueue();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'TM_GC_QUEUE_SALES') {
    enqueueSales(message.events)
      .then((queue) => {
        sendResponse({ ok: true, queue });
        void flushQueue();
      })
      .catch((error) => {
        sendResponse({ ok: false, error: String(error?.message || error) });
      });
    return true;
  }

  if (message?.type === 'TM_GC_CONFIG_UPDATED') {
    resetErrorsAfterConfigurationChange()
      .then(() => {
        sendResponse({ ok: true });
        void flushQueue();
      })
      .catch((error) => {
        sendResponse({ ok: false, error: String(error?.message || error) });
      });
    return true;
  }

  if (message?.type === 'TM_GC_SYNC_STATUS') {
    getPublicStatus().then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: String(error?.message || error) });
    });
    return true;
  }
});

ensureAlarm();
void flushQueue();
