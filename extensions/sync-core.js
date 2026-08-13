(function initializeSyncCore(root, factory) {
  const api = factory();
  root.TimeMasterGenteCrystalSync = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSyncCore() {
  'use strict';

  const MAX_BACKOFF_MS = 15 * 60 * 1000;
  const STALE_SENDING_MS = 2 * 60 * 1000;
  const TICKET_PATTERN = /^\d{4,}-\d{2,}-\d{5,}$/;

  function requireTicketId(value) {
    const ticketId = String(value || '').trim();
    if (!TICKET_PATTERN.test(ticketId)) {
      throw new Error('Invalid ticketId.');
    }
    return ticketId;
  }

  function buildActivePayload(sale) {
    const ticketId = requireTicketId(sale?.ticketId || sale?.ticket);
    const sorteo = String(sale?.sorteo || '').trim();
    const monto = Number(sale?.monto);
    const dateValue = sale?.saleAt ?? sale?.timestamp;
    const saleAt = new Date(dateValue);

    if (!sorteo || sorteo.length > 160) throw new Error('Invalid sorteo.');
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('Invalid monto.');
    if (!Number.isFinite(saleAt.getTime())) throw new Error('Invalid saleAt.');

    return {
      ticketId,
      sorteo,
      monto,
      saleAt: saleAt.toISOString(),
      status: 'active',
    };
  }

  function buildDeletedPayload(ticket) {
    const ticketId = requireTicketId(
      typeof ticket === 'object' ? ticket?.ticketId || ticket?.ticket : ticket,
    );
    return { ticketId, status: 'deleted' };
  }

  function normalizeEvent(event) {
    if (event?.status === 'deleted') return buildDeletedPayload(event);
    if (event?.status === 'active') return buildActivePayload(event);
    throw new Error('Invalid sale status.');
  }

  function payloadsEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function enqueueEvents(queue, events, now = Date.now()) {
    const original = queue || {};
    let next = original;
    for (const rawEvent of Array.isArray(events) ? events : []) {
      const payload = normalizeEvent(rawEvent);
      const current = next[payload.ticketId];
      if (current && payloadsEqual(current.payload, payload)) continue;

      if (next === original) next = { ...original };
      next[payload.ticketId] = {
        ticketId: payload.ticketId,
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

  function updateMatching(queue, ticketId, revision, update) {
    const next = { ...(queue || {}) };
    const current = next[ticketId];
    if (!current || current.revision !== revision) return next;
    next[ticketId] = { ...current, ...update };
    return next;
  }

  function markSending(queue, ticketId, revision, now = Date.now()) {
    return updateMatching(queue, ticketId, revision, {
      state: 'sending',
      updatedAt: now,
    });
  }

  function markSucceeded(queue, revision, ticketId, now = Date.now()) {
    return updateMatching(queue, ticketId, revision, {
      state: 'synced',
      retryable: false,
      nextAttemptAt: null,
      lastError: null,
      updatedAt: now,
      syncedAt: now,
    });
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

  function sanitizeErrorMessage(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  }

  function markFailed(
    queue,
    ticketId,
    revision,
    failure = {},
    now = Date.now(),
  ) {
    const current = queue?.[ticketId];
    if (!current || current.revision !== revision) return { ...(queue || {}) };

    const classification = classifyHttpFailure(failure.status);
    const attempts = Number(current.attempts || 0) + 1;
    const message = sanitizeErrorMessage(failure.message);
    return updateMatching(queue, ticketId, revision, {
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
        if (record.state === 'pending') {
          return Number(record.nextAttemptAt || 0) <= now;
        }
        if (record.state === 'error') {
          return (
            record.retryable === true &&
            Number(record.nextAttemptAt || 0) <= now
          );
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
    for (const [ticketId, record] of Object.entries(next)) {
      if (record.state !== 'error') continue;
      next[ticketId] = {
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
    const summary = {
      total: 0,
      pending: 0,
      sending: 0,
      synced: 0,
      error: 0,
    };
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
      throw new Error('Invalid TimeMaster URL.');
    }

    const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Invalid TimeMaster URL.');
    }
    if (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) {
      throw new Error('TimeMaster must use HTTPS outside local development.');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid TimeMaster URL.');
    }

    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }

  return {
    buildActivePayload,
    buildDeletedPayload,
    classifyHttpFailure,
    computeBackoffMs,
    enqueueEvents,
    getReadyRecords,
    markFailed,
    markSending,
    markSucceeded,
    normalizeApiBaseUrl,
    resetErroredRecords,
    summarizeQueue,
  };
});
