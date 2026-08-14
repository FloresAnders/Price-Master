const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
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

test('the print page exposes the exact locally generated ticket', () => {
  assert.equal(
    syncCore.extractPrintedTicketId(`Grupo Cafetero
41820-2204-59199878
13/08/2026 19:13:46
AF826AAD
Puesto: Tiempos Delikor Palmares`),
    '41820-2204-59199878',
  );
});

test('a printed confirmation classifies only its exact ticket as local', () => {
  assert.deepEqual(
    syncCore.classifyNewSales(
      [
        { ticket: '41820-2204-59199877' },
        { ticket: '41820-2204-59199878' },
      ],
      [],
      2_000,
      [{ ticketId: '41820-2204-59199878', confirmedAt: 1_000 }],
    ),
    {
      sales: [
        { ticket: '41820-2204-59199877', captureOrigin: 'indirect' },
        { ticket: '41820-2204-59199878', captureOrigin: 'local_button' },
      ],
      intents: [],
      confirmedTickets: [],
    },
  );
});

test('a printed confirmation also consumes its matching click intent', () => {
  const intent = syncCore.createLocalSaleIntent([], 1_000);

  assert.deepEqual(
    syncCore.classifyNewSales(
      [
        { ticket: '41820-2204-59199878', timestamp: 1_500 },
        { ticket: '41820-2204-59199879', timestamp: 1_600 },
      ],
      [intent],
      2_000,
      [{ ticketId: '41820-2204-59199878', confirmedAt: 1_500 }],
    ),
    {
      sales: [
        {
          ticket: '41820-2204-59199878',
          timestamp: 1_500,
          captureOrigin: 'local_button',
        },
        {
          ticket: '41820-2204-59199879',
          timestamp: 1_600,
          captureOrigin: 'indirect',
        },
      ],
      intents: [],
      confirmedTickets: [],
    },
  );
});

test('a confirmed ticket reserves its click intent regardless of sale order', () => {
  const intent = syncCore.createLocalSaleIntent([], 1_000);

  assert.deepEqual(
    syncCore.classifyNewSales(
      [
        { ticket: '41820-2204-59199879', timestamp: 1_600 },
        { ticket: '41820-2204-59199878', timestamp: 1_500 },
      ],
      [intent],
      2_000,
      [{ ticketId: '41820-2204-59199878', confirmedAt: 1_500 }],
    ),
    {
      sales: [
        {
          ticket: '41820-2204-59199879',
          timestamp: 1_600,
          captureOrigin: 'indirect',
        },
        {
          ticket: '41820-2204-59199878',
          timestamp: 1_500,
          captureOrigin: 'local_button',
        },
      ],
      intents: [],
      confirmedTickets: [],
    },
  );
});

test('multiple confirmed tickets reserve multiple intents chronologically', () => {
  const firstIntent = syncCore.createLocalSaleIntent([], 1_000);
  const secondIntent = syncCore.createLocalSaleIntent([], 3_000);

  assert.deepEqual(
    syncCore.classifyNewSales(
      [
        { ticket: '41820-2204-59199879', timestamp: 3_500 },
        { ticket: '41820-2204-59199878', timestamp: 1_500 },
        { ticket: '41820-2204-59199880', timestamp: 3_600 },
      ],
      [firstIntent, secondIntent],
      4_000,
      [
        { ticketId: '41820-2204-59199879', confirmedAt: 3_500 },
        { ticketId: '41820-2204-59199878', confirmedAt: 1_500 },
      ],
    ),
    {
      sales: [
        {
          ticket: '41820-2204-59199879',
          timestamp: 3_500,
          captureOrigin: 'local_button',
        },
        {
          ticket: '41820-2204-59199878',
          timestamp: 1_500,
          captureOrigin: 'local_button',
        },
        {
          ticket: '41820-2204-59199880',
          timestamp: 3_600,
          captureOrigin: 'indirect',
        },
      ],
      intents: [],
      confirmedTickets: [],
    },
  );
});

test('recording a printed confirmation replaces the older duplicate', () => {
  assert.deepEqual(
    syncCore.appendConfirmedLocalTicket(
      [
        { ticketId: '41820-2204-59199878', confirmedAt: 500 },
        { ticketId: '41820-2204-59199879', confirmedAt: 750 },
      ],
      '41820-2204-59199878',
      1_000,
    ),
    [
      { ticketId: '41820-2204-59199879', confirmedAt: 750 },
      { ticketId: '41820-2204-59199878', confirmedAt: 1_000 },
    ],
  );
});

test('printed confirmations retain only the newest fifty tickets', () => {
  const existing = Array.from({ length: 50 }, (_, index) => ({
    ticketId: `41820-2204-${59199000 + index}`,
    confirmedAt: 1_000 + index,
  }));

  const result = syncCore.appendConfirmedLocalTicket(
    existing,
    '41820-2204-59199999',
    2_000,
  );

  assert.equal(result.length, 50);
  assert.equal(
    result.some((marker) => marker.ticketId === '41820-2204-59199000'),
    false,
  );
  assert.deepEqual(result.at(-1), {
    ticketId: '41820-2204-59199999',
    confirmedAt: 2_000,
  });
});

test('a printed confirmation remains valid for exactly twenty-four hours', () => {
  assert.deepEqual(
    syncCore.classifyNewSales(
      [{ ticket: '41820-2204-59199878' }],
      [],
      86_400_000,
      [{ ticketId: '41820-2204-59199878', confirmedAt: 0 }],
    ),
    {
      sales: [
        { ticket: '41820-2204-59199878', captureOrigin: 'local_button' },
      ],
      intents: [],
      confirmedTickets: [],
    },
  );
});

test('expired or malformed printed confirmations cannot mark a sale local', () => {
  assert.deepEqual(
    syncCore.classifyNewSales(
      [{ ticket: '41820-2204-59199878' }],
      [],
      86_400_001,
      [
        { ticketId: '41820-2204-59199878', confirmedAt: 0 },
        { ticketId: '41820-2204-59199878', confirmedAt: 'invalid' },
        { ticketId: 'bad-ticket', confirmedAt: 1_000 },
        { ticketId: '41820-2204-59199878', confirmedAt: 86_400_002 },
      ],
    ),
    {
      sales: [
        { ticket: '41820-2204-59199878', captureOrigin: 'indirect' },
      ],
      intents: [],
      confirmedTickets: [],
    },
  );
});

test('a pending print confirmation defers a new sale until its exact marker arrives', () => {
  const pending = syncCore.appendPendingLocalConfirmation([], 1_000);
  const sale = { ticket: '41820-2204-59199878', timestamp: 1_500 };

  assert.deepEqual(
    syncCore.prepareNewSalesForPrintConfirmation(
      [sale],
      [],
      pending,
      2_000,
    ),
    {
      readySales: [],
      deferredSales: [sale],
      pendingConfirmations: [{ createdAt: 1_000 }],
    },
  );

  assert.deepEqual(
    syncCore.prepareNewSalesForPrintConfirmation(
      [sale],
      [{ ticketId: '41820-2204-59199878', confirmedAt: 2_500 }],
      pending,
      3_000,
    ),
    {
      readySales: [sale],
      deferredSales: [],
      pendingConfirmations: [],
    },
  );
});

test('an unconfirmed print wait expires after fifteen seconds', () => {
  const sale = { ticket: '41820-2204-59199878' };

  assert.deepEqual(
    syncCore.prepareNewSalesForPrintConfirmation(
      [sale],
      [],
      [{ createdAt: 1_000 }],
      16_001,
    ),
    {
      readySales: [sale],
      deferredSales: [],
      pendingConfirmations: [],
    },
  );
});

test('the print page persists the exact generated ticket confirmation', async () => {
  const storage = {};
  const context = {
    chrome: {
      storage: {
        local: {
          async get(key) {
            return { [key]: storage[key] };
          },
          async set(value) {
            Object.assign(storage, value);
          },
        },
      },
    },
    console: { error() {} },
    Date: class extends Date {
      static now() {
        return 1_000;
      }
    },
    document: {
      body: {
        innerText: `Grupo Cafetero
41820-2204-59199878
13/08/2026 19:13:46
AF826AAD
Puesto: Tiempos Delikor Palmares`,
      },
    },
    TimeMasterGenteCrystalSync: syncCore,
  };
  context.globalThis = context;

  const source = fs.readFileSync(
    path.join(__dirname, 'print-confirmation.js'),
    'utf8',
  );
  await vm.runInNewContext(source, context);

  assert.deepEqual(storage, {
    genteCrystalConfirmedLocalTickets: [
      { ticketId: '41820-2204-59199878', confirmedAt: 1_000 },
    ],
  });
});

test('the entries detector waits for a late printed confirmation before saving', async () => {
  const storage = {
    ventasGenteCrystal: [],
    genteCrystalConfirmedLocalTickets: [],
    genteCrystalPendingLocalConfirmations: [],
  };
  const runtimeMessages = [];
  let clickListener;
  let onMessage;
  let ticketVisible = false;
  const saleRow = {
    className: '',
    getAttribute() {
      return null;
    },
    id: '',
    innerText: '13/08/2026 07:13 PM 41820-2204-59199878 ₡50',
    querySelectorAll() {
      return [];
    },
    textContent: '13/08/2026 07:13 PM 41820-2204-59199878 ₡50',
  };
  const table = {
    querySelectorAll(selector) {
      return selector === 'tr' && ticketVisible ? [saleRow] : [];
    },
  };
  const select = {
    addEventListener() {},
    dataset: {},
    id: 'sorteo',
    name: 'sorteo',
    options: [{ textContent: '13/08/2026 NICA NOCHE' }],
    selectedIndex: 0,
  };
  class FakeElement {}
  const context = {
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            onMessage = listener;
          },
        },
        async sendMessage(message) {
          runtimeMessages.push(message);
          return { ok: true };
        },
      },
      storage: {
        local: {
          async get(keys) {
            const requested = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(
              requested.map((key) => [key, storage[key]]),
            );
          },
          async set(value) {
            Object.assign(storage, value);
          },
        },
      },
    },
    clearInterval() {},
    clearTimeout() {},
    console: { error() {}, log() {} },
    Date: class extends Date {
      static now() {
        return 2_000;
      }
    },
    document: {
      addEventListener(type, listener) {
        if (type === 'click') clickListener = listener;
      },
      body: {},
      getElementById() {
        return null;
      },
      querySelectorAll(selector) {
        if (selector === 'select') return [select];
        if (selector === 'table') return [table];
        return [];
      },
      removeEventListener() {},
    },
    Element: FakeElement,
    getComputedStyle() {
      return { backgroundColor: 'rgba(0, 0, 0, 0)' };
    },
    HTMLInputElement: class extends FakeElement {},
    MutationObserver: class {
      disconnect() {}
      observe() {}
    },
    setInterval() {
      return 1;
    },
    setTimeout() {
      return 1;
    },
    TimeMasterGenteCrystalSync: syncCore,
  };
  context.globalThis = context;

  const source = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));

  const ingresarVenta = new FakeElement();
  ingresarVenta.closest = () => ingresarVenta;
  ingresarVenta.innerText = 'Ingresar venta';
  clickListener({ target: ingresarVenta });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(storage.genteCrystalPendingLocalConfirmations, [
    { createdAt: 2_000 },
  ]);
  ticketVisible = true;

  const firstScan = await new Promise((resolve) => {
    assert.equal(
      onMessage({ type: 'TM_FORCE_SCAN' }, {}, resolve),
      true,
    );
  });

  assert.equal(firstScan.ok, true);
  assert.equal(storage.ventasGenteCrystal.length, 0);
  assert.equal(
    runtimeMessages.some((message) =>
      message.events?.some(
        (event) => event.ticketId === '41820-2204-59199878',
      ),
    ),
    false,
  );

  storage.genteCrystalConfirmedLocalTickets = [
    { ticketId: '41820-2204-59199878', confirmedAt: 1_500 },
  ];
  const secondScan = await new Promise((resolve) => {
    assert.equal(
      onMessage({ type: 'TM_FORCE_SCAN' }, {}, resolve),
      true,
    );
  });

  assert.equal(secondScan.ok, true);
  assert.equal(storage.ventasGenteCrystal.length, 1);
  assert.equal(
    storage.ventasGenteCrystal[0].captureOrigin,
    'local_button',
  );
  assert.deepEqual(storage.genteCrystalConfirmedLocalTickets, []);
  assert.deepEqual(storage.genteCrystalPendingLocalConfirmations, []);
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
