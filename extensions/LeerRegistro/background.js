'use strict';

const BCR_PATTERN =
  'https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*';
const CONTICA_PATTERN = 'https://contica.app/app/modules/cierre/*';
const TIEMPOS_URL = 'https://www.timemaster.es/#tiempostucan';
const MESSAGE_TIMEOUT_MS = 130000;
const BCR_NAVIGATION_RETRIES = 4;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'Error desconocido.');
}

async function getFirstOpenTab(pattern, sourceName) {
  const tabs = await chrome.tabs.query({ url: pattern });
  const tab = tabs.find((candidate) => Number.isInteger(candidate.id));

  if (!tab?.id) {
    throw new Error(`Abra ${sourceName} en una pestaña antes de cargar los datos.`);
  }

  return tab;
}

function waitForTabComplete(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('La pestaña auxiliar de Tiempos no terminó de cargar.'));
    }, timeoutMs);

    const finish = () => {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    }).catch((error) => {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      reject(error);
    });
  });
}

async function ensureCollector(tabId, contentFile) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'LR_PING' });
    if (response?.ok) return;
  } catch (_error) {
    // Una extensión recién instalada no se inyecta en pestañas ya abiertas.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['core.js', contentFile],
  });
}

async function sendCollectorMessage(tabId, contentFile, message) {
  await ensureCollector(tabId, contentFile);

  let timeoutId;
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, message),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('La consulta excedió el tiempo de espera.')),
          MESSAGE_TIMEOUT_MS,
        );
      }),
    ]);

    if (!response?.ok) {
      throw new Error(response?.error || 'La fuente no devolvió un resultado válido.');
    }
    return response.data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isClosedMessageChannelError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('message channel closed') ||
    message.includes('receiving end does not exist') ||
    message.includes('the tab was closed')
  );
}

async function waitForTabSettled(tabId, timeoutMs = 45000) {
  const startedAt = Date.now();
  let completeSince = null;

  while (Date.now() - startedAt < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      completeSince ||= Date.now();
      if (Date.now() - completeSince >= 300) return;
    } else {
      completeSince = null;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error('BCR no terminó de cargar después de cambiar de página.');
}

async function sendBcrCollectorMessage(tabId, message) {
  let lastError;

  for (let attempt = 0; attempt < BCR_NAVIGATION_RETRIES; attempt += 1) {
    try {
      return await sendCollectorMessage(tabId, 'bcr-content.js', message);
    } catch (error) {
      lastError = error;
      if (!isClosedMessageChannelError(error)) throw error;
      await waitForTabSettled(tabId);
    }
  }

  throw new Error(
    `BCR cambió de página demasiadas veces sin completar el reporte: ${getErrorMessage(lastError)}`,
  );
}

async function createTiemposTab() {
  const tab = await chrome.tabs.create({ url: TIEMPOS_URL, active: false });
  if (!tab.id) throw new Error('No se pudo abrir el reporte de Tiempos.');
  try {
    await waitForTabComplete(tab.id);
    return { tab, temporary: true };
  } catch (error) {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
    throw error;
  }
}

async function collectAll() {
  const requestedAt = Date.now();
  const [bcrTab, conticaTab] = await Promise.all([
    getFirstOpenTab(BCR_PATTERN, 'BCR Corresponsales'),
    getFirstOpenTab(CONTICA_PATTERN, 'el reporte de cierres de Contica'),
  ]);
  const tiemposContext = await createTiemposTab();

  try {
    const [bcr, contica, tiempos] = await Promise.all([
      sendBcrCollectorMessage(bcrTab.id, {
        type: 'LR_COLLECT_BCR',
        requestedAt,
      }),
      sendCollectorMessage(conticaTab.id, 'contica-content.js', {
        type: 'LR_COLLECT_CONTICA',
        requestedAt,
      }),
      sendCollectorMessage(tiemposContext.tab.id, 'timemaster-content.js', {
        type: 'LR_COLLECT_TIEMPOS',
        requestedAt,
      }),
    ]);

    const result = {
      r08: contica.r08,
      t11: contica.t11,
      tucan: bcr.total,
      tiempos: tiempos.total,
      reportDate: bcr.reportDate,
    };

    if (bcr.reportDate !== tiempos.reportDate) {
      throw new Error('BCR y Tiempos no consultaron la misma fecha operativa.');
    }

    for (const [name, value] of Object.entries(result)) {
      if (name === 'reportDate') continue;
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`El valor ${name.toUpperCase()} no es válido.`);
      }
    }

    return result;
  } finally {
    if (tiemposContext.temporary && tiemposContext.tab.id) {
      await chrome.tabs.remove(tiemposContext.tab.id).catch(() => undefined);
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LR_COLLECT_ALL') return false;

  collectAll()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: getErrorMessage(error) }));
  return true;
});
