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
  const LOCAL_SALE_INTENT_MS = 2 * 60 * 1000;
  const LOCAL_SALE_TIMESTAMP_TOLERANCE_MS = 1 * 1000;
  const MAX_PENDING_LOCAL_SALE_INTENTS = 20;
  const LOCAL_PRINT_CONFIRMATION_GRACE_MS = 15 * 1000;
  const MAX_PENDING_LOCAL_CONFIRMATIONS = 20;
  const CONFIRMED_LOCAL_TICKET_MS = 24 * 60 * 60 * 1000;
  const MAX_CONFIRMED_LOCAL_TICKETS = 50;
  const CONNECTION_SAVE_PASSWORD = 'TIMEMASTER2026!';
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
    const captureOrigin =
      sale?.captureOrigin === 'local_button' ? 'local_button' : 'indirect';

    if (!sorteo || sorteo.length > 160) throw new Error('Invalid sorteo.');
    if (!Number.isFinite(monto) || monto <= 0) throw new Error('Invalid monto.');
    if (!Number.isFinite(saleAt.getTime())) throw new Error('Invalid saleAt.');

    return {
      ticketId,
      sorteo,
      monto,
      saleAt: saleAt.toISOString(),
      captureOrigin,
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

  function resolveStableSaleTimestamp(
    observedTimestamp,
    existingTimestamp,
    now = Date.now(),
  ) {
    const observed = Number(observedTimestamp);
    if (Number.isFinite(observed) && observed > 0) return observed;

    const existing = Number(existingTimestamp);
    if (Number.isFinite(existing) && existing > 0) return existing;

    return now;
  }

  function createLocalSaleIntent(visibleTicketIds, now = Date.now()) {
    return {
      clickedAt: now,
      ticketIdsBeforeClick: [...new Set(
        (Array.isArray(visibleTicketIds) ? visibleTicketIds : [])
          .map((ticketId) => String(ticketId || '').trim())
          .filter(Boolean),
      )],
    };
  }

  function validLocalSaleIntents(intents, now) {
    const candidates = Array.isArray(intents)
      ? intents
      : intents
        ? [intents]
        : [];
    return candidates.filter((intent) => {
      const clickedAt = Number(intent?.clickedAt);
      return (
        Number.isFinite(clickedAt) &&
        now >= clickedAt &&
        now - clickedAt <= LOCAL_SALE_INTENT_MS
      );
    });
  }

  function appendLocalSaleIntent(
    intents,
    visibleTicketIds,
    now = Date.now(),
  ) {
    return [
      ...validLocalSaleIntents(intents, now),
      createLocalSaleIntent(visibleTicketIds, now),
    ].slice(-MAX_PENDING_LOCAL_SALE_INTENTS);
  }

  function isIngresarVentaLabel(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase() === 'ingresar venta';
  }

  function isConnectionSaveAuthorized(value) {
    return value === CONNECTION_SAVE_PASSWORD;
  }

  function extractPrintedTicketId(value) {
    const match = String(value || '').match(/\b\d{4,}-\d{2,}-\d{5,}\b/);
    return match ? match[0] : null;
  }

  function validConfirmedLocalTickets(markers, now) {
    return (Array.isArray(markers) ? markers : []).filter((marker) => {
      const ticketId = String(marker?.ticketId || '').trim();
      const confirmedAt = marker?.confirmedAt;
      return (
        TICKET_PATTERN.test(ticketId) &&
        typeof confirmedAt === 'number' &&
        Number.isFinite(confirmedAt) &&
        now >= confirmedAt &&
        now - confirmedAt <= CONFIRMED_LOCAL_TICKET_MS
      );
    });
  }

  function appendConfirmedLocalTicket(markers, ticketId, now = Date.now()) {
    const normalizedTicketId = requireTicketId(ticketId);
    return [
      ...validConfirmedLocalTickets(markers, now).filter(
        (marker) => marker.ticketId !== normalizedTicketId,
      ),
      { ticketId: normalizedTicketId, confirmedAt: now },
    ].slice(-MAX_CONFIRMED_LOCAL_TICKETS);
  }

  function validPendingLocalConfirmations(pending, now) {
    return (Array.isArray(pending) ? pending : []).filter((confirmation) => {
      const createdAt = confirmation?.createdAt;
      return (
        typeof createdAt === 'number' &&
        Number.isFinite(createdAt) &&
        now >= createdAt &&
        now - createdAt <= LOCAL_PRINT_CONFIRMATION_GRACE_MS
      );
    });
  }

  function appendPendingLocalConfirmation(pending, now = Date.now()) {
    return [
      ...validPendingLocalConfirmations(pending, now),
      { createdAt: now },
    ].slice(-MAX_PENDING_LOCAL_CONFIRMATIONS);
  }

  function prepareNewSalesForPrintConfirmation(
    sales,
    confirmedTickets,
    pendingConfirmations,
    now = Date.now(),
  ) {
    const pending = validPendingLocalConfirmations(pendingConfirmations, now);
    const confirmedTicketIds = new Set(
      validConfirmedLocalTickets(confirmedTickets, now).map(
        (marker) => marker.ticketId,
      ),
    );
    const readySales = [];
    const deferredSales = [];

    for (const sale of Array.isArray(sales) ? sales : []) {
      const ticketId = String(sale?.ticketId || sale?.ticket || '').trim();
      if (confirmedTicketIds.has(ticketId) && pending.length) {
        pending.shift();
        readySales.push(sale);
      } else if (pending.length) {
        deferredSales.push(sale);
      } else {
        readySales.push(sale);
      }
    }

    return {
      readySales,
      deferredSales,
      pendingConfirmations: pending,
    };
  }

  function parseObservedSaleDateTime(value) {
    const match = String(value || '').match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\b/i,
    );
    if (!match) return null;

    const [, ddRaw, mmRaw, yyyy, hhRaw, min, secMatch, apRaw] = match;
    const secRaw = secMatch || '00';
    const dd = ddRaw.padStart(2, '0');
    const mm = mmRaw.padStart(2, '0');
    const ap = apRaw.toUpperCase();

    let hh24 = Number(hhRaw);
    if (ap === 'PM' && hh24 !== 12) hh24 += 12;
    if (ap === 'AM' && hh24 === 12) hh24 = 0;

    const timestamp = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      hh24,
      Number(min),
      Number(secRaw),
    ).getTime();

    return {
      fecha: `${dd}/${mm}/${yyyy}`,
      hora: `${hhRaw.padStart(2, '0')}:${min}${secMatch ? `:${secRaw}` : ''} ${ap}`,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      timestampPrecisionMs: secMatch ? 1000 : 60_000,
    };
  }

  function classifyNewSales(
    sales,
    intents,
    now = Date.now(),
    confirmedTickets,
  ) {
    const hasConfirmedTickets = arguments.length >= 4;
    const pendingConfirmedTickets = hasConfirmedTickets
      ? validConfirmedLocalTickets(confirmedTickets, now)
      : [];
    const pendingIntents = validLocalSaleIntents(intents, now)
      .map((intent) => ({
        ...intent,
        ticketIdsBeforeClick: new Set(
          Array.isArray(intent?.ticketIdsBeforeClick)
            ? intent.ticketIdsBeforeClick
            : [],
        ),
      }))
      .sort((left, right) => Number(left.clickedAt) - Number(right.clickedAt));

    const preparedSales = (Array.isArray(sales) ? sales : []).map((sale, index) => {
      const ticketId = String(sale?.ticketId || sale?.ticket || '').trim();
      const rawTimestamp = sale?.timestamp ?? sale?.saleAt;
      const parsedTimestamp =
        typeof rawTimestamp === 'number'
          ? rawTimestamp
          : new Date(rawTimestamp).getTime();
      const saleTimestamp = Number.isFinite(parsedTimestamp)
        ? parsedTimestamp
        : null;
      const rawPrecision = Number(sale?.timestampPrecisionMs);
      const timestampPrecisionMs =
        Number.isFinite(rawPrecision) && rawPrecision > 0
          ? rawPrecision
          : 0;
      return {
        sale,
        ticketId,
        saleTimestamp,
        timestampPrecisionMs,
        isConfirmedLocalSale: false,
        confirmedAt: null,
        index,
      };
    });

    const findMatchingIntentIndex = (preparedSale) =>
      pendingIntents.findIndex((intent) => {
        if (
          !preparedSale.ticketId ||
          intent.ticketIdsBeforeClick.has(preparedSale.ticketId)
        ) {
          return false;
        }
        return (
          preparedSale.saleTimestamp === null ||
          preparedSale.saleTimestamp + preparedSale.timestampPrecisionMs >
            Number(intent.clickedAt) - LOCAL_SALE_TIMESTAMP_TOLERANCE_MS
        );
      });

    for (const preparedSale of preparedSales) {
      const confirmedTicketIndex = pendingConfirmedTickets.findIndex(
        (marker) => marker.ticketId === preparedSale.ticketId,
      );
      if (confirmedTicketIndex < 0) continue;

      preparedSale.isConfirmedLocalSale = true;
      preparedSale.confirmedAt =
        pendingConfirmedTickets[confirmedTicketIndex].confirmedAt;
      pendingConfirmedTickets.splice(confirmedTicketIndex, 1);
    }

    const confirmedSalesInTimeOrder = preparedSales
      .filter((preparedSale) => preparedSale.isConfirmedLocalSale)
      .sort((left, right) => {
        const leftTimestamp = left.saleTimestamp ?? left.confirmedAt;
        const rightTimestamp = right.saleTimestamp ?? right.confirmedAt;
        return leftTimestamp - rightTimestamp || left.index - right.index;
      });
    for (const preparedSale of confirmedSalesInTimeOrder) {
      const matchingIntentIndex = findMatchingIntentIndex(preparedSale);
      if (matchingIntentIndex >= 0) {
        pendingIntents.splice(matchingIntentIndex, 1);
      }
    }

    const classifiedSales = preparedSales.map((preparedSale) => {
      const matchingIntentIndex = preparedSale.isConfirmedLocalSale
        ? -1
        : findMatchingIntentIndex(preparedSale);
      const isIntentLocalSale = matchingIntentIndex >= 0;
      if (isIntentLocalSale) pendingIntents.splice(matchingIntentIndex, 1);
      return {
        ...preparedSale.sale,
        captureOrigin:
          preparedSale.isConfirmedLocalSale || isIntentLocalSale
            ? 'local_button'
            : 'indirect',
      };
    });

    const result = {
      sales: classifiedSales,
      intents: pendingIntents.map((intent) => ({
        clickedAt: intent.clickedAt,
        ticketIdsBeforeClick: [...intent.ticketIdsBeforeClick],
      })),
    };
    if (hasConfirmedTickets) {
      result.confirmedTickets = pendingConfirmedTickets;
    }
    return result;
  }

  function enqueueEvents(queue, events, now = Date.now()) {
    const original = queue || {};
    let next = original;
    for (const rawEvent of Array.isArray(events) ? events : []) {
      const payload = normalizeEvent(rawEvent);
      const current = next[payload.ticketId];
      if (current?.payload?.status === 'deleted') continue;
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

    if (url.hostname === 'timemaster.es') {
      url.hostname = 'www.timemaster.es';
    }

    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }

  function isExtensionContextInvalidatedError(error) {
    const message =
      error instanceof Error ? error.message : String(error || '');
    return /extension context invalidated/i.test(message);
  }

  return {
    appendConfirmedLocalTicket,
    appendLocalSaleIntent,
    appendPendingLocalConfirmation,
    buildActivePayload,
    buildDeletedPayload,
    classifyHttpFailure,
    classifyNewSales,
    computeBackoffMs,
    createLocalSaleIntent,
    enqueueEvents,
    extractPrintedTicketId,
    getReadyRecords,
    isConnectionSaveAuthorized,
    isIngresarVentaLabel,
    isExtensionContextInvalidatedError,
    markFailed,
    markSending,
    markSucceeded,
    normalizeApiBaseUrl,
    parseObservedSaleDateTime,
    prepareNewSalesForPrintConfirmation,
    resolveStableSaleTimestamp,
    resetErroredRecords,
    summarizeQueue,
  };
});
