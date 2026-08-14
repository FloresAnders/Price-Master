(async () => {
  'use strict';

  const STORAGE_KEY = 'genteCrystalConfirmedLocalTickets';
  const syncCore = globalThis.TimeMasterGenteCrystalSync;

  try {
    if (!syncCore) throw new Error('No se cargó el núcleo de sincronización.');

    const ticketId = syncCore.extractPrintedTicketId(
      document.body?.innerText || document.body?.textContent || '',
    );
    if (!ticketId) return;

    const result = await chrome.storage.local.get(STORAGE_KEY);
    const markers = syncCore.appendConfirmedLocalTicket(
      result[STORAGE_KEY],
      ticketId,
      Date.now(),
    );
    await chrome.storage.local.set({ [STORAGE_KEY]: markers });
  } catch (error) {
    console.error(
      '[TimeMaster] No se pudo confirmar el tiquete impreso:',
      error,
    );
  }
})();
