(function initializeBcrSyncCore(root, factory) {
  const api = factory();
  root.TimeMasterBcrSync = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBcrSyncCore() {
  'use strict';

  const MAX_BACKOFF_MS = 15 * 60 * 1000;
  const STALE_SENDING_MS = 2 * 60 * 1000;
  const MAX_SYNCED_RECORDS = 500;
  const CONNECTION_SAVE_PASSWORD = 'TIMEMASTER2026!';
  const RECEIPT_ID_PATTERN = /^[a-f0-9]{64}$/;

  function normalizeReceipt(receipt) {
    const receiptId = String(receipt?.receiptId || '').trim().toLowerCase();
    const monto = Number(receipt?.monto);
    const paidAt = new Date(receipt?.paidAt);
    if (!RECEIPT_ID_PATTERN.test(receiptId)) throw new Error('Invalid receiptId.');
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('Invalid monto.');
    if (!Number.isFinite(paidAt.getTime())) throw new Error('Invalid paidAt.');
    return { receiptId, monto, paidAt: paidAt.toISOString() };
  }

  function enqueueReceipts(queue, receipts, now = Date.now()) {
    const original = queue || {};
    let next = pruneQueue(original);
    for (const rawReceipt of Array.isArray(receipts) ? receipts : []) {
      const payload = normalizeReceipt(rawReceipt);
      const current = next[payload.receiptId];
      if (current && JSON.stringify(current.payload) === JSON.stringify(payload)) continue;
      if (next === original) next = { ...original };
      next[payload.receiptId] = {
        receiptId: payload.receiptId,
        payload,
        state: 'pending',
        revision: Number(current?.revision || 0) + 1,
        attempts: 0,
        retryable: true,
        nextAttemptAt: now,
        lastError: null,
        updatedAt: now,
        syncedAt: null,
      };
    }
    return next;
  }

  function updateMatching(queue, receiptId, revision, update) {
    const next = { ...(queue || {}) };
    const current = next[receiptId];
    if (!current || current.revision !== revision) return next;
    next[receiptId] = { ...current, ...update };
    return next;
  }

  function markSending(queue, receiptId, revision, now = Date.now()) {
    return updateMatching(queue, receiptId, revision, {
      state: 'sending',
      updatedAt: now,
    });
  }

  function markSucceeded(queue, receiptId, revision, now = Date.now()) {
    return pruneQueue(
      updateMatching(queue, receiptId, revision, {
        state: 'synced',
        retryable: false,
        nextAttemptAt: null,
        lastError: null,
        updatedAt: now,
        syncedAt: now,
      }),
    );
  }

  function pruneQueue(queue) {
    const original = queue || {};
    const synced = Object.values(original)
      .filter((record) => record?.state === 'synced')
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
    if (synced.length <= MAX_SYNCED_RECORDS) return original;
    const retained = new Set(
      synced.slice(0, MAX_SYNCED_RECORDS).map((record) => record.receiptId),
    );
    const next = {};
    for (const [receiptId, record] of Object.entries(original)) {
      if (record?.state !== 'synced' || retained.has(receiptId)) {
        next[receiptId] = record;
      }
    }
    return next;
  }

  function classifyHttpFailure(status) {
    const numericStatus = Number(status);
    if (!Number.isFinite(numericStatus) || numericStatus <= 0) {
      return { retryable: true, code: 'network_error' };
    }
    return {
      retryable:
        numericStatus === 408 ||
        numericStatus === 429 ||
        numericStatus >= 500,
      code: `http_${numericStatus}`,
    };
  }

  function computeBackoffMs(attempts) {
    const safeAttempts = Math.max(1, Number(attempts) || 1);
    return Math.min(5000 * 2 ** (safeAttempts - 1), MAX_BACKOFF_MS);
  }

  function markFailed(queue, receiptId, revision, failure = {}, now = Date.now()) {
    const current = queue?.[receiptId];
    if (!current || current.revision !== revision) return { ...(queue || {}) };
    const classification = classifyHttpFailure(failure.status);
    const attempts = Number(current.attempts || 0) + 1;
    const message = String(failure.message || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    return updateMatching(queue, receiptId, revision, {
      state: 'error',
      attempts,
      retryable: classification.retryable,
      nextAttemptAt: classification.retryable
        ? now + computeBackoffMs(attempts)
        : null,
      lastError: message
        ? `${classification.code}: ${message}`
        : classification.code,
      updatedAt: now,
    });
  }

  function getReadyRecords(queue, now = Date.now()) {
    return Object.values(queue || {})
      .filter((record) => {
        if (record.state === 'pending') return Number(record.nextAttemptAt || 0) <= now;
        if (record.state === 'error') {
          return record.retryable === true && Number(record.nextAttemptAt || 0) <= now;
        }
        if (record.state === 'sending') {
          return now - Number(record.updatedAt || 0) >= STALE_SENDING_MS;
        }
        return false;
      })
      .sort((left, right) => left.updatedAt - right.updatedAt);
  }

  function resetErroredRecords(queue, now = Date.now()) {
    const next = { ...(queue || {}) };
    for (const [receiptId, record] of Object.entries(next)) {
      if (record.state !== 'error') continue;
      next[receiptId] = {
        ...record,
        state: 'pending',
        attempts: 0,
        retryable: true,
        nextAttemptAt: now,
        lastError: null,
        updatedAt: now,
      };
    }
    return next;
  }

  function summarizeQueue(queue) {
    const summary = { total: 0, pending: 0, sending: 0, synced: 0, error: 0 };
    for (const record of Object.values(queue || {})) {
      summary.total += 1;
      if (record.state in summary) summary[record.state] += 1;
    }
    return summary;
  }

  function normalizeApiBaseUrl(value) {
    let url;
    try {
      url = new URL(String(value || '').trim());
    } catch (_error) {
      throw new Error('URL de TimeMaster inválida.');
    }
    const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) {
      throw new Error('TimeMaster debe usar HTTPS fuera del desarrollo local.');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('URL de TimeMaster inválida.');
    }
    if (url.hostname === 'timemaster.es') url.hostname = 'www.timemaster.es';
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }

  return {
    enqueueReceipts,
    getReadyRecords,
    isConnectionSaveAuthorized: (value) => value === CONNECTION_SAVE_PASSWORD,
    markFailed,
    markSending,
    markSucceeded,
    normalizeApiBaseUrl,
    normalizeReceipt,
    resetErroredRecords,
    summarizeQueue,
  };
});
