(async () => {
  'use strict';

  const CONFIRMED_TICKETS_KEY = 'genteCrystalConfirmedLocalTickets';
  const PENDING_LOCAL_CONFIRMATIONS_KEY =
    'genteCrystalPendingLocalConfirmations';
  const SALES_STORAGE_KEY = 'ventasGenteCrystal';
  const syncCore = globalThis.TimeMasterGenteCrystalSync;
  const MAX_WAIT_MS = 15000;
  const RETRY_MS = 500;
  const EXTENSION_VERSION = '1.7.0';
  const TICKET_REGEX = /\b\d{4,}-\d{2,6}-\d{5,}\b/g;

  function getPageText() {
    return (
      document.body?.innerText ||
      document.body?.textContent ||
      document.documentElement?.innerText ||
      document.documentElement?.textContent ||
      ''
    );
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function extractTicketIds(value) {
    const text = String(value || '');
    const matches = text.match(TICKET_REGEX) || [];
    return [...new Set(matches.map((ticketId) => String(ticketId).trim()))];
  }

  function extractTicketFromUrl() {
    const raw = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return syncCore.extractPrintedTicketId(raw);
  }

  function extractTicketFromDom() {
    const bodyText = document.body?.innerText || document.body?.textContent || '';
    if (bodyText) {
      const fromBody = extractTicketIds(bodyText)[0] || null;
      if (fromBody) return fromBody;
    }

    const htmlText = document.documentElement?.innerText || document.documentElement?.textContent || '';
    return extractTicketIds(htmlText)[0] || null;
  }

  function extractTicketIdsFromPage() {
    const fromUrl = extractTicketIds(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    const fromDom = extractTicketIds(getPageText());
    return [...new Set([...fromUrl, ...fromDom])];
  }

  function parseDateTimeFromPrintText(text) {
    const normalized = normalizeWhitespace(text);
    const parsed12h = syncCore.parseObservedSaleDateTime(normalized);
    if (parsed12h) return parsed12h;

    const match24h = normalized.match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/
    );
    if (!match24h) return null;

    const [, ddRaw, mmRaw, yyyyRaw, hhRaw, minRaw, secRaw] = match24h;
    const dd = String(ddRaw).padStart(2, '0');
    const mm = String(mmRaw).padStart(2, '0');
    const yyyy = String(yyyyRaw);
    const hh = String(hhRaw).padStart(2, '0');
    const min = String(minRaw).padStart(2, '0');
    const sec = String(secRaw || '00').padStart(2, '0');

    const timestamp = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(min),
      Number(sec)
    ).getTime();

    if (!Number.isFinite(timestamp)) return null;

    return {
      fecha: `${dd}/${mm}/${yyyy}`,
      hora: `${hh}:${min}:${sec}`,
      timestamp,
      timestampPrecisionMs: secRaw ? 1000 : 60_000,
    };
  }

  function parseMontoFromPrintText(text) {
    const normalized = normalizeWhitespace(text);
    const totals = [...normalized.matchAll(/\btotal\s*:\s*([\d.,]+)/gi)];
    if (totals.length) {
      const raw = totals[totals.length - 1][1];
      const digits = String(raw || '').replace(/[^\d]/g, '');
      const parsed = Number(digits || 0);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
  }

  function parseSorteoFromPrintText(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fechaSorteoIndex = lines.findIndex((line) =>
      /^fecha\s+sorteo\s*:/i.test(line),
    );
    if (fechaSorteoIndex >= 0) {
      for (let i = fechaSorteoIndex + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (/^cliente\s*:/i.test(line)) break;
        if (/^[A-ZÁÉÍÓÚÑ0-9\s-]{3,}$/i.test(line)) {
          return normalizeWhitespace(line).toUpperCase();
        }
      }
    }

    return 'SIN SORTEO';
  }

  function buildSaleFromPrint(ticketId, text) {
    const parsedDateTime = parseDateTimeFromPrintText(text);
    const monto = parseMontoFromPrintText(text);
    const sorteo = parseSorteoFromPrintText(text);

    if (!parsedDateTime || monto <= 0) return null;

    return {
      id: `GC-${ticketId}`,
      ticket: ticketId,
      sorteo,
      monto,
      fecha: parsedDateTime.fecha,
      hora: parsedDateTime.hora,
      captureOrigin: 'local_button',
      timestamp: parsedDateTime.timestamp,
      timestampPrecisionMs: parsedDateTime.timestampPrecisionMs,
    };
  }

  function splitPrintIntoTicketBlocks(text) {
    const lines = String(text || '').split(/\r?\n/);
    const blocks = [];
    let current = null;

    for (const rawLine of lines) {
      const line = String(rawLine || '').trim();
      if (!line) {
        if (current) current.lines.push('');
        continue;
      }

      const lineTickets = extractTicketIds(line);
      if (lineTickets.length) {
        if (current) blocks.push(current);
        current = { ticketId: lineTickets[0], lines: [line] };
        continue;
      }

      if (current) current.lines.push(line);
    }

    if (current) blocks.push(current);
    return blocks;
  }

  function buildSalesFromPrintText(text) {
    const blocks = splitPrintIntoTicketBlocks(text);
    const sales = [];

    for (const block of blocks) {
      const sale = buildSaleFromPrint(block.ticketId, block.lines.join('\n'));
      if (sale) sales.push(sale);
    }

    return sales;
  }

  async function saveTickets(ticketIds) {
    const uniqueTicketIds = [...new Set((Array.isArray(ticketIds) ? ticketIds : []).filter(Boolean))];
    if (!uniqueTicketIds.length) return;

    const result = await chrome.storage.local.get([
      CONFIRMED_TICKETS_KEY,
      PENDING_LOCAL_CONFIRMATIONS_KEY,
    ]);
    let markers = result[CONFIRMED_TICKETS_KEY];
    const now = Date.now();

    for (const ticketId of uniqueTicketIds) {
      markers = syncCore.appendConfirmedLocalTicket(markers, ticketId, now);
    }

    const pending = Array.isArray(result[PENDING_LOCAL_CONFIRMATIONS_KEY])
      ? [...result[PENDING_LOCAL_CONFIRMATIONS_KEY]]
      : [];
    const consumeCount = Math.min(uniqueTicketIds.length, pending.length);
    if (consumeCount > 0) pending.splice(0, consumeCount);

    await chrome.storage.local.set({
      [CONFIRMED_TICKETS_KEY]: markers,
      [PENDING_LOCAL_CONFIRMATIONS_KEY]: pending,
    });
  }

  async function saveSaleLocally(sale) {
    const result = await chrome.storage.local.get(SALES_STORAGE_KEY);
    const currentSales = Array.isArray(result[SALES_STORAGE_KEY])
      ? result[SALES_STORAGE_KEY]
      : [];
    const withoutCurrentTicket = currentSales.filter(
      (item) => String(item?.ticket || '').trim() !== sale.ticket,
    );
    const nextSales = [...withoutCurrentTicket, sale].sort(
      (a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0),
    );
    await chrome.storage.local.set({ [SALES_STORAGE_KEY]: nextSales });
  }

  async function enqueueSale(sale) {
    const payload = syncCore.buildActivePayload({
      ticketId: sale.ticket,
      sorteo: sale.sorteo,
      monto: sale.monto,
      saleAt: sale.timestamp,
      captureOrigin: sale.captureOrigin,
    });

    const response = await chrome.runtime.sendMessage({
      type: 'TM_GC_QUEUE_SALES',
      events: [payload],
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'No se pudo encolar la venta.');
    }
  }

  async function enqueueSales(sales) {
    if (!sales.length) return;
    const payloads = sales.map((sale) =>
      syncCore.buildActivePayload({
        ticketId: sale.ticket,
        sorteo: sale.sorteo,
        monto: sale.monto,
        saleAt: sale.timestamp,
        captureOrigin: sale.captureOrigin,
      }),
    );

    const response = await chrome.runtime.sendMessage({
      type: 'TM_GC_QUEUE_SALES',
      events: payloads,
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'No se pudieron encolar las ventas.');
    }
  }

  async function saveSalesLocally(sales) {
    if (!sales.length) return;

    const result = await chrome.storage.local.get(SALES_STORAGE_KEY);
    const currentSales = Array.isArray(result[SALES_STORAGE_KEY])
      ? result[SALES_STORAGE_KEY]
      : [];
    const incomingByTicket = new Map(sales.map((sale) => [sale.ticket, sale]));
    const filtered = currentSales.filter(
      (item) => !incomingByTicket.has(String(item?.ticket || '').trim()),
    );
    const nextSales = [...filtered, ...sales].sort(
      (a, b) => Number(a?.timestamp || 0) - Number(b?.timestamp || 0),
    );

    await chrome.storage.local.set({ [SALES_STORAGE_KEY]: nextSales });
  }

  async function captureFromPrintPage(ticketId) {
    const pageText = getPageText();
    let sales = buildSalesFromPrintText(pageText);

    if (!sales.length) {
      const fallbackSale = buildSaleFromPrint(ticketId, pageText);
      if (fallbackSale) sales = [fallbackSale];
    }
    if (!sales.length) return false;

    await Promise.all([saveSalesLocally(sales), enqueueSales(sales)]);
    return true;
  }

  async function waitAndRegisterTicket() {
    const startAt = Date.now();
    let savedTicketIds = [];

    while (Date.now() - startAt <= MAX_WAIT_MS) {
      const ticketIds = savedTicketIds.length
        ? savedTicketIds
        : extractTicketIdsFromPage();
      if (ticketIds.length) {
        if (!savedTicketIds.length) {
          await saveTickets(ticketIds);
          savedTicketIds = ticketIds;
        }

        const captured = await captureFromPrintPage(ticketIds[0]);
        if (captured) return true;
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }

    return false;
  }

  async function buildStatusResponse() {
    const result = await chrome.storage.local.get(SALES_STORAGE_KEY);
    const sales = Array.isArray(result[SALES_STORAGE_KEY])
      ? result[SALES_STORAGE_KEY]
      : [];

    return {
      ok: true,
      version: EXTENSION_VERSION,
      sorteo: parseSorteoFromPrintText(getPageText()),
      guardadas: sales.length,
      diagnostico: {
        tablaEncontrada: true,
        filasConTicket: extractTicketIdsFromPage().length,
        borrados: 0,
      },
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'TM_FORCE_SCAN') {
      waitAndRegisterTicket()
        .then(async (ok) => {
          const status = await buildStatusResponse();
          sendResponse(
            ok
              ? status
              : {
                  ok: false,
                  motivo: 'sin_ticket_o_datos_incompletos',
                  diagnostico: status.diagnostico,
                },
          );
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            motivo: 'error',
            error: String(error?.message || error),
          });
        });
      return true;
    }

    if (message?.type === 'TM_STATUS') {
      buildStatusResponse()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({ ok: false, error: String(error?.message || error) });
        });
      return true;
    }
  });

  try {
    if (!syncCore) throw new Error('No se cargó el núcleo de sincronización.');
    await waitAndRegisterTicket();
  } catch (error) {
    console.error(
      '[TimeMaster] No se pudo confirmar el tiquete impreso:',
      error,
    );
  }
})();
