const assert = require('node:assert/strict');
const test = require('node:test');
const syncCore = require('./sync-core.js');
const {
  buildActivePayload,
  buildDeletedPayload,
  classifyHttpFailure,
  computeBackoffMs,
  enqueueEvents,
  getReadyRecords,
  isExtensionContextInvalidatedError,
  markFailed,
  markSending,
  markSucceeded,
  normalizeApiBaseUrl,
  resolveStableSaleTimestamp,
  resetErroredRecords,
  summarizeQueue,
} = syncCore;

const ticketId = '41783-2204-59175496';
const activePayload = {
  ticketId,
  sorteo: '12/08/2026 NY NOCHE',
  monto: 100,
  saleAt: '2026-08-13T02:14:00.000Z',
  captureOrigin: 'local_button',
  status: 'active',
};

test('active detector sales become API payloads', () => {
  assert.deepEqual(
    buildActivePayload({
      ticket: ticketId,
      sorteo: ' 12/08/2026 NY NOCHE ',
      monto: 100,
      timestamp: Date.parse('2026-08-13T02:14:00.000Z'),
      captureOrigin: 'local_button',
    }),
    activePayload,
  );
});

test('detector sales without a click marker become indirect API payloads', () => {
  assert.deepEqual(
    buildActivePayload({
      ticket: ticketId,
      sorteo: '12/08/2026 NY NOCHE',
      monto: 100,
      timestamp: Date.parse('2026-08-13T02:14:00.000Z'),
    }),
    { ...activePayload, captureOrigin: 'indirect' },
  );
});

test('missing sale times reuse the first fallback across detector polls', () => {
  const firstTimestamp = resolveStableSaleTimestamp(null, null, 1000);
  const repeatedTimestamp = resolveStableSaleTimestamp(
    null,
    firstTimestamp,
    2200,
  );

  assert.equal(firstTimestamp, 1000);
  assert.equal(repeatedTimestamp, 1000);
});

test('a real detected sale time replaces an earlier fallback', () => {
  assert.equal(resolveStableSaleTimestamp(3000, 1000, 4000), 3000);
});

test('one click classifies only the next new ticket as local', () => {
  const createLocalSaleIntent = Reflect.get(syncCore, 'createLocalSaleIntent');
  const classifyNewSales = Reflect.get(syncCore, 'classifyNewSales');
  assert.equal(typeof createLocalSaleIntent, 'function');
  assert.equal(typeof classifyNewSales, 'function');
  if (!createLocalSaleIntent || !classifyNewSales) return;

  const intent = createLocalSaleIntent(['41783-2204-59175495'], 1000);
  const result = classifyNewSales(
    [
      { ticket: '41783-2204-59175495' },
      { ticket: '41783-2204-59175496' },
      { ticket: '41783-2204-59175497' },
    ],
    [intent],
    2000,
  );

  assert.deepEqual(result.sales, [
    { ticket: '41783-2204-59175495', captureOrigin: 'indirect' },
    { ticket: '41783-2204-59175496', captureOrigin: 'local_button' },
    { ticket: '41783-2204-59175497', captureOrigin: 'indirect' },
  ]);
  assert.deepEqual(result.intents, []);
});

test('sales without a recent click are indirect', () => {
  const createLocalSaleIntent = Reflect.get(syncCore, 'createLocalSaleIntent');
  const classifyNewSales = Reflect.get(syncCore, 'classifyNewSales');
  assert.equal(typeof createLocalSaleIntent, 'function');
  assert.equal(typeof classifyNewSales, 'function');
  if (!createLocalSaleIntent || !classifyNewSales) return;

  assert.deepEqual(
    classifyNewSales([{ ticket: ticketId }], [], 2000),
    {
      sales: [{ ticket: ticketId, captureOrigin: 'indirect' }],
      intents: [],
    },
  );
  assert.deepEqual(
    classifyNewSales(
      [{ ticket: ticketId }],
      [createLocalSaleIntent([], 1000)],
      121001,
    ),
    {
      sales: [{ ticket: ticketId, captureOrigin: 'indirect' }],
      intents: [],
    },
  );
});

test('an older external sale does not consume the local click intent', () => {
  const intent = syncCore.createLocalSaleIntent([], 10_000);
  const result = syncCore.classifyNewSales(
    [
      { ticket: '41783-2204-59175497', timestamp: 8_000 },
      { ticket: '41783-2204-59175498', timestamp: 11_000 },
    ],
    [intent],
    12_000,
  );

  assert.deepEqual(result, {
    sales: [
      {
        ticket: '41783-2204-59175497',
        timestamp: 8_000,
        captureOrigin: 'indirect',
      },
      {
        ticket: '41783-2204-59175498',
        timestamp: 11_000,
        captureOrigin: 'local_button',
      },
    ],
    intents: [],
  });
});

test('a local sale may arrive more than fifteen seconds after its click', () => {
  const intent = syncCore.createLocalSaleIntent([], 1_000);

  assert.deepEqual(
    syncCore.classifyNewSales(
      [{ ticket: ticketId, timestamp: 31_000 }],
      [intent],
      31_000,
    ),
    {
      sales: [
        { ticket: ticketId, timestamp: 31_000, captureOrigin: 'local_button' },
      ],
      intents: [],
    },
  );
});

test('minute-precision sale times can still match a click later in that minute', () => {
  const intent = syncCore.createLocalSaleIntent([], 55_000);

  assert.deepEqual(
    syncCore.classifyNewSales(
      [
        {
          ticket: ticketId,
          timestamp: 0,
          timestampPrecisionMs: 60_000,
        },
      ],
      [intent],
      56_000,
    ),
    {
      sales: [
        {
          ticket: ticketId,
          timestamp: 0,
          timestampPrecisionMs: 60_000,
          captureOrigin: 'local_button',
        },
      ],
      intents: [],
    },
  );
});

test('observed sale times expose whether the table included seconds', () => {
  const parseObservedSaleDateTime = Reflect.get(
    syncCore,
    'parseObservedSaleDateTime',
  );
  assert.equal(typeof parseObservedSaleDateTime, 'function');
  if (!parseObservedSaleDateTime) return;

  assert.deepEqual(
    {
      ...parseObservedSaleDateTime('13/08/2026 10:55 PM'),
      timestamp: 0,
    },
    {
      fecha: '13/08/2026',
      hora: '10:55 PM',
      timestamp: 0,
      timestampPrecisionMs: 60_000,
    },
  );
  assert.equal(
    parseObservedSaleDateTime('13/08/2026 10:55:42 PM')
      ?.timestampPrecisionMs,
    1_000,
  );
});

test('consecutive clicks retain one intent for each generated sale', () => {
  const appendLocalSaleIntent = Reflect.get(
    syncCore,
    'appendLocalSaleIntent',
  );
  assert.equal(typeof appendLocalSaleIntent, 'function');
  if (!appendLocalSaleIntent) return;

  let intents = appendLocalSaleIntent([], [], 1_000);
  intents = appendLocalSaleIntent(intents, [], 2_000);

  assert.deepEqual(
    syncCore.classifyNewSales(
      [
        { ticket: '41783-2204-59175497', timestamp: 1_500 },
        { ticket: '41783-2204-59175498', timestamp: 2_500 },
      ],
      intents,
      3_000,
    ),
    {
      sales: [
        {
          ticket: '41783-2204-59175497',
          timestamp: 1_500,
          captureOrigin: 'local_button',
        },
        {
          ticket: '41783-2204-59175498',
          timestamp: 2_500,
          captureOrigin: 'local_button',
        },
      ],
      intents: [],
    },
  );
});

test('only the Ingresar venta control creates a local sale intent', () => {
  const isIngresarVentaLabel = Reflect.get(syncCore, 'isIngresarVentaLabel');
  assert.equal(typeof isIngresarVentaLabel, 'function');
  if (!isIngresarVentaLabel) return;

  assert.equal(isIngresarVentaLabel('Ingresar venta'), true);
  assert.equal(isIngresarVentaLabel('  INGRESAR   VENTA  '), true);
  assert.equal(isIngresarVentaLabel('Ingresar ventas'), false);
  assert.equal(isIngresarVentaLabel('Borrar venta'), false);
});

test('connection configuration requires the exact password', () => {
  const isConnectionSaveAuthorized = Reflect.get(
    syncCore,
    'isConnectionSaveAuthorized',
  );
  assert.equal(typeof isConnectionSaveAuthorized, 'function');
  if (!isConnectionSaveAuthorized) return;

  assert.equal(isConnectionSaveAuthorized('TIMEMASTER2026!'), true);
  assert.equal(isConnectionSaveAuthorized('timemaster2026!'), false);
  assert.equal(isConnectionSaveAuthorized(' TIMEMASTER2026! '), false);
  assert.equal(isConnectionSaveAuthorized(''), false);
  assert.equal(isConnectionSaveAuthorized(null), false);
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

test('a deleted ticket remains terminal when the detector reports it as active', () => {
  const deletedQueue = enqueueEvents(
    {},
    [{ ticketId, status: 'deleted' }],
    1000,
  );
  const syncedDeletion = markSucceeded(deletedQueue, 1, ticketId, 1100);
  const replayedAsActive = enqueueEvents(
    syncedDeletion,
    [activePayload],
    1200,
  );

  assert.equal(replayedAsActive, syncedDeletion);
  assert.deepEqual(replayedAsActive[ticketId], syncedDeletion[ticketId]);
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

test('extension reload context errors are recognized without hiding other failures', () => {
  assert.equal(
    isExtensionContextInvalidatedError(new Error('Extension context invalidated.')),
    true,
  );
  assert.equal(
    isExtensionContextInvalidatedError('Error: Extension context invalidated.'),
    true,
  );
  assert.equal(
    isExtensionContextInvalidatedError(new Error('Could not establish connection.')),
    false,
  );
});
