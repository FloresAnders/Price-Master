(function initConticaCollector() {
  'use strict';

  if (globalThis.__leerRegistroConticaLoaded) return;
  globalThis.__leerRegistroConticaLoaded = true;

  const Core = globalThis.LeerRegistroCore;
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  function getSearchButton() {
    return (
      document.querySelector('form.report-filters button[type="submit"][aria-label="Buscar"]') ||
      Core.findByText(document, 'form.report-filters button', 'Buscar')
    );
  }

  async function selectLastSevenDays() {
    const toggle = document.querySelector('.drp-date-filter .drp-toggle-btn');
    if (!toggle) throw new Error('No se encontró el filtro de período en Contica.');

    if (Core.normalizeText(toggle.textContent).includes('ultimos 7 dias')) return;

    toggle.click();
    const option = await Core.waitFor(
      () => {
        const label = Core.findByText(
          document,
          '.drp-date-filter .drp-hdr-opt-label',
          'Últimos 7 días',
        );
        return label?.closest('button') || null;
      },
      { message: 'No se encontró el período “Últimos 7 días” en Contica.' },
    );
    option.click();
  }

  function findViewButtons() {
    return Array.from(document.querySelectorAll('button, a')).filter((element) => {
      if (!Core.isVisible(element)) return false;
      const text = Core.normalizeText(element.textContent);
      const title = Core.normalizeText(element.getAttribute('title'));
      const ariaLabel = Core.normalizeText(element.getAttribute('aria-label'));
      const originalTitle = Core.normalizeText(
        element.getAttribute('data-original-title'),
      );
      return [text, title, ariaLabel, originalTitle].some(
        (value) => value === 'ver' || value.startsWith('ver '),
      );
    });
  }

  function getTableOpeningCell(row) {
    const table = row.closest('table');
    if (!table) return null;
    const headers = Array.from(table.querySelectorAll('thead th'));
    const openingIndex = headers.findIndex((header) => {
      const text = Core.normalizeText(header.textContent);
      return text.includes('fecha') && text.includes('apertura');
    });
    if (openingIndex < 0) return null;
    return row.querySelectorAll('td')[openingIndex] || null;
  }

  function getOpeningDate(viewButton) {
    const row = viewButton.closest('tr');
    if (row) {
      const openingCell = getTableOpeningCell(row);
      const parsedCellDate = Core.parseCostaRicaDate(openingCell?.textContent);
      if (parsedCellDate) return parsedCellDate;
    }

    const container =
      row ||
      viewButton.closest('[class*="card"]') ||
      viewButton.closest('[class*="item"]') ||
      viewButton.parentElement;
    const text = container?.textContent || '';
    const openingMatch = text.match(
      /(?:fecha\s+de\s+)?apertura[^\d]*(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?)?)/i,
    );
    if (openingMatch) return Core.parseCostaRicaDate(openingMatch[1]);

    return Core.parseCostaRicaDate(text);
  }

  function findClosestEligibleClosure(now = new Date()) {
    const threshold = now.getTime() - TWO_HOURS_MS;
    const candidates = findViewButtons()
      .map((button) => ({ button, openingDate: getOpeningDate(button) }))
      .filter(
        (candidate) =>
          candidate.openingDate && candidate.openingDate.getTime() <= threshold,
      )
      .sort((left, right) => right.openingDate.getTime() - left.openingDate.getTime());

    return candidates[0] || null;
  }

  function findProductTotals() {
    const section = document.querySelector('#transacciones_producto');
    if (!section || !Core.isVisible(section)) return null;

    const totals = {};
    for (const row of section.querySelectorAll('tbody tr')) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 3) continue;
      const productName = Core.normalizeText(cells[0].textContent);
      if (productName !== 'tucan' && productName !== 'tiempos') continue;

      const amount = Core.parseMoney(cells[2].textContent);
      if (amount === null) continue;
      totals[productName] = amount;
    }

    if (!Number.isFinite(totals.tucan) || !Number.isFinite(totals.tiempos)) {
      return null;
    }

    return { r08: totals.tucan, t11: totals.tiempos };
  }

  async function closeOpenProductModal() {
    const section = document.querySelector('#transacciones_producto');
    if (!section || !Core.isVisible(section)) return;

    const modal = section.closest('.modal') || section.parentElement;
    const closeButton =
      modal?.querySelector('[data-dismiss="modal"]') ||
      modal?.querySelector('button.close') ||
      Array.from(modal?.querySelectorAll('button') || []).find((button) => {
        const label = Core.normalizeText(
          button.getAttribute('aria-label') || button.textContent,
        );
        return label === 'cerrar' || label === 'close' || label === '×';
      });

    if (!closeButton) {
      throw new Error('Cierre el detalle abierto de Contica e intente nuevamente.');
    }

    closeButton.click();
    await Core.waitFor(
      () => !section.isConnected || !Core.isVisible(section),
      { message: 'Contica no cerró el detalle anterior.' },
    );
  }

  async function collectConticaTotals(requestedAt) {
    await Core.waitFor(getSearchButton, {
      timeoutMs: 45000,
      message: 'Contica no cargó el formulario de cierres.',
    });
    await selectLastSevenDays();
    await closeOpenProductModal();

    const searchButton = getSearchButton();
    if (!searchButton) throw new Error('No se encontró el botón Buscar en Contica.');
    const previousButtons = new Set(findViewButtons());
    let observedSearch = false;
    searchButton.click();

    await Core.waitFor(() => {
      const currentSearchButton = getSearchButton();
      if (currentSearchButton?.disabled) {
        observedSearch = true;
        return false;
      }

      const viewButtons = findViewButtons();
      const replacedResults = viewButtons.some(
        (button) => !previousButtons.has(button),
      );
      return viewButtons.length > 0 && (observedSearch || replacedResults);
    }, {
      timeoutMs: 45000,
      message: 'Contica no confirmó resultados nuevos para la búsqueda de cierres.',
    });

    const closure = findClosestEligibleClosure(new Date(requestedAt));
    if (!closure) {
      throw new Error(
        'No se encontró un cierre de Contica cuya apertura tenga al menos 2 horas.',
      );
    }
    closure.button.click();

    return Core.waitFor(findProductTotals, {
      timeoutMs: 45000,
      message: 'El cierre de Contica no mostró filas exactas para TUCAN y TIEMPOS.',
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'LR_PING') {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type !== 'LR_COLLECT_CONTICA') return false;

    collectConticaTotals(message.requestedAt)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  });
})();
