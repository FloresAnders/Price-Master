const assert = require('node:assert/strict');
const test = require('node:test');
const {
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
} = require('./sync-core.js');

const ticketId = '41783-2204-59175496';
const activePayload = {
  ticketId,
  sorteo: '12/08/2026 NY NOCHE',
  monto: 100,
  saleAt: '2026-08-13T02:14:00.000Z',
  status: 'active',
};

test('active detector sales become API payloads', () => {
  assert.deepEqual(
    buildActivePayload({
      ticket: ticketId,
      sorteo: ' 12/08/2026 NY NOCHE ',
      monto: 100,
      timestamp: Date.parse('2026-08-13T02:14:00.000Z'),
    }),
    activePayload,
  );
});

test('deleted detector tickets become minimal tombstones', () => {
  assert.deepEqual(buildDeletedPayload(ticketId), {
    ticketId,
    status: 'deleted',
  });
});

test('polling an unchanged event does not create another revision', () => {
  const first = enqueueEvents({}, [activePayload], 1000);
  const second = enqueueEvents(first, [{ ...activePayload }], 2000);

  assert.equal(first[ticketId].revision, 1);
  assert.equal(second, first);
  assert.deepEqual(second[ticketId], first[ticketId]);
});

test('a newer deletion replaces a synced active state', () => {
  const activeQueue = enqueueEvents({}, [activePayload], 1000);
  const synced = markSucceeded(
    activeQueue,
    activeQueue[ticketId].revision,
    ticketId,
    1100,
  );
  const deleted = enqueueEvents(
    synced,
    [{ ticketId, status: 'deleted' }],
    1200,
  );

  assert.equal(deleted[ticketId].state, 'pending');
  assert.equal(deleted[ticketId].revision, 2);
  assert.deepEqual(deleted[ticketId].payload, {
    ticketId,
    status: 'deleted',
  });
});

test('an old response cannot sync a newer revision', () => {
  const revisionOne = enqueueEvents({}, [activePayload], 1000);
  const revisionTwo = enqueueEvents(
    revisionOne,
    [{ ticketId, status: 'deleted' }],
    1200,
  );
  const result = markSucceeded(revisionTwo, 1, ticketId, 1300);

  assert.deepEqual(result[ticketId], revisionTwo[ticketId]);
});

test('markSending changes only the matching revision', () => {
  const queue = enqueueEvents({}, [activePayload], 1000);
  assert.equal(markSending(queue, ticketId, 2, 1100)[ticketId].state, 'pending');
  assert.equal(markSending(queue, ticketId, 1, 1100)[ticketId].state, 'sending');
});

test('retry classification separates temporary and terminal responses', () => {
  assert.deepEqual(classifyHttpFailure(408), { retryable: true, code: 'http_408' });
  assert.deepEqual(classifyHttpFailure(429), { retryable: true, code: 'http_429' });
  assert.deepEqual(classifyHttpFailure(503), { retryable: true, code: 'http_503' });
  assert.deepEqual(classifyHttpFailure(401), { retryable: false, code: 'http_401' });
  assert.deepEqual(classifyHttpFailure(400), { retryable: false, code: 'http_400' });
});

test('network retry backoff is exponential and capped at fifteen minutes', () => {
  assert.equal(computeBackoffMs(1), 5000);
  assert.equal(computeBackoffMs(2), 10000);
  assert.equal(computeBackoffMs(20), 15 * 60 * 1000);
});

test('failed records retain retry metadata without changing revision', () => {
  const queue = enqueueEvents({}, [activePayload], 1000);
  const sending = markSending(queue, ticketId, 1, 1100);
  const failed = markFailed(
    sending,
    ticketId,
    1,
    { status: 503, message: 'service unavailable' },
    1200,
  );

  assert.deepEqual(failed[ticketId], {
    ...sending[ticketId],
    state: 'error',
    attempts: 1,
    retryable: true,
    nextAttemptAt: 6200,
    lastError: 'http_503: service unavailable',
    updatedAt: 1200,
  });
});

test('only pending, retryable due, or stale sending records are ready', () => {
  const pending = enqueueEvents({}, [activePayload], 1000);
  const retryable = markFailed(
    markSending(pending, ticketId, 1, 1100),
    ticketId,
    1,
    { status: 503 },
    1200,
  );
  assert.equal(getReadyRecords(retryable, 6199).length, 0);
  assert.equal(getReadyRecords(retryable, 6200).length, 1);

  const terminal = markFailed(
    markSending(pending, ticketId, 1, 1100),
    ticketId,
    1,
    { status: 401 },
    1200,
  );
  assert.equal(getReadyRecords(terminal, 999999).length, 0);

  const sending = markSending(pending, ticketId, 1, 1100);
  assert.equal(getReadyRecords(sending, 1100 + 119999).length, 0);
  assert.equal(getReadyRecords(sending, 1100 + 120000).length, 1);
});

test('configuration changes reset errored records to pending', () => {
  const pending = enqueueEvents({}, [activePayload], 1000);
  const terminal = markFailed(
    markSending(pending, ticketId, 1, 1100),
    ticketId,
    1,
    { status: 401 },
    1200,
  );
  const reset = resetErroredRecords(terminal, 2000);

  assert.equal(reset[ticketId].state, 'pending');
  assert.equal(reset[ticketId].attempts, 0);
  assert.equal(reset[ticketId].nextAttemptAt, 2000);
  assert.equal(reset[ticketId].lastError, null);
});

test('queue summaries expose counts but no payload data', () => {
  const pending = enqueueEvents({}, [activePayload], 1000);
  const synced = markSucceeded(pending, 1, ticketId, 1100);
  assert.deepEqual(summarizeQueue(synced), {
    total: 1,
    pending: 0,
    sending: 0,
    synced: 1,
    error: 0,
  });
});

test('API base URLs require HTTPS except for local development', () => {
  assert.equal(normalizeApiBaseUrl('https://timemaster.es/'), 'https://www.timemaster.es');
  assert.equal(normalizeApiBaseUrl('https://www.timemaster.es/'), 'https://www.timemaster.es');
  assert.equal(normalizeApiBaseUrl('http://localhost:3000/'), 'http://localhost:3000');
  assert.equal(normalizeApiBaseUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  assert.throws(() => normalizeApiBaseUrl('http://timemaster.es'), /HTTPS/);
  assert.throws(() => normalizeApiBaseUrl('javascript:alert(1)'), /URL/);
});
