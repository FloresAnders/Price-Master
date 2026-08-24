const STORAGE_KEY = 'bcrCapturedReceipts';
const CONFIG_KEY = 'bcrIntegrationConfig';
const QUEUE_KEY = 'bcrSyncQueue';
const syncCore = globalThis.TimeMasterBcrSync;

const tbody = document.getElementById('comprobantes');
const empty = document.getElementById('vacio');
const counter = document.getElementById('contador');
const apiUrlInput = document.getElementById('api-url');
const tokenInput = document.getElementById('device-token');
const syncStatus = document.getElementById('sync-status');
const syncIndicator = document.getElementById('sync-indicator');
const configMessage = document.getElementById('config-message');
const saveButton = document.getElementById('guardar-config');
const passwordDialog = document.getElementById('connection-password-dialog');
const passwordForm = document.getElementById('connection-password-form');
const passwordInput = document.getElementById('connection-password');
const passwordError = document.getElementById('connection-password-error');
const cancelPasswordButton = document.getElementById('cancelar-password');

function setConfigMessage(text, type = '') {
  configMessage.textContent = text;
  configMessage.className = `config-message ${type}`.trim();
}

function formatReceiptTime(paidAt) {
  const date = new Date(paidAt);
  if (!Number.isFinite(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

async function loadConfiguration() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const config = result[CONFIG_KEY] || {};
  apiUrlInput.value = config.apiBaseUrl || 'https://www.timemaster.es';
  tokenInput.value = typeof config.token === 'string' ? config.token : '';
}

async function loadReceipts() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const receipts = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  const sorted = [...receipts].sort((left, right) =>
    String(right.paidAt || '').localeCompare(String(left.paidAt || '')),
  );
  counter.textContent = String(sorted.length);
  tbody.replaceChildren();
  empty.style.display = sorted.length ? 'none' : 'block';
  for (const receipt of sorted) {
    const row = document.createElement('tr');
    const time = document.createElement('td');
    const amount = document.createElement('td');
    time.textContent = formatReceiptTime(receipt.paidAt);
    time.className = 'time';
    amount.textContent = `₡${Number(receipt.monto || 0).toLocaleString('es-CR', { maximumFractionDigits: 2 })}`;
    amount.className = 'right amount';
    row.append(time, amount);
    tbody.appendChild(row);
  }
}

async function checkSync() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TM_BCR_SYNC_STATUS' });
    if (!response?.ok) throw new Error(response?.error || 'Sin respuesta');
    const queue = response.queue || {};
    syncStatus.textContent = [
      `${queue.pending || 0} pendientes`,
      `${queue.sending || 0} enviando`,
      `${queue.synced || 0} sincronizados`,
      `${queue.error || 0} con error`,
    ].join(' · ');
    if ((queue.error || 0) > 0) {
      syncIndicator.textContent = 'Con errores';
      syncIndicator.className = 'sync-indicator error';
    } else if (response.configured) {
      syncIndicator.textContent = 'Conectado';
      syncIndicator.className = 'sync-indicator ok';
    } else {
      syncIndicator.textContent = 'Sin configurar';
      syncIndicator.className = 'sync-indicator';
    }
  } catch (_error) {
    syncStatus.textContent = 'No se pudo consultar el service worker.';
    syncIndicator.textContent = 'No disponible';
    syncIndicator.className = 'sync-indicator error';
  }
}

function requestConnectionAuthorization() {
  passwordInput.value = '';
  passwordError.textContent = '';
  passwordDialog.returnValue = '';
  return new Promise((resolve) => {
    const finish = () => {
      passwordForm.removeEventListener('submit', confirmPassword);
      cancelPasswordButton.removeEventListener('click', cancel);
      passwordInput.value = '';
      resolve(passwordDialog.returnValue === 'authorized');
    };
    const confirmPassword = (event) => {
      event.preventDefault();
      if (!syncCore.isConnectionSaveAuthorized(passwordInput.value)) {
        passwordInput.value = '';
        passwordError.textContent = 'Contraseña incorrecta.';
        passwordInput.focus();
        return;
      }
      passwordDialog.close('authorized');
    };
    const cancel = () => passwordDialog.close('cancelled');
    passwordForm.addEventListener('submit', confirmPassword);
    cancelPasswordButton.addEventListener('click', cancel);
    passwordDialog.addEventListener('close', finish, { once: true });
    passwordDialog.showModal();
    passwordInput.focus();
  });
}

async function saveConfiguration() {
  setConfigMessage('Guardando…');
  try {
    const apiBaseUrl = syncCore.normalizeApiBaseUrl(apiUrlInput.value);
    const token = tokenInput.value.trim();
    if (token && !/^tm_bcr_[A-Za-z0-9_-]{8,160}$/.test(token)) {
      throw new Error('El token debe comenzar con tm_bcr_.');
    }
    await chrome.storage.local.set({ [CONFIG_KEY]: { apiBaseUrl, token } });
    const response = await chrome.runtime.sendMessage({ type: 'TM_BCR_CONFIG_UPDATED' });
    if (!response?.ok) throw new Error(response?.error || 'No se pudo activar la conexión.');
    apiUrlInput.value = apiBaseUrl;
    setConfigMessage(
      token ? 'Conexión guardada. La cola se enviará automáticamente.' : 'URL guardada. Agrega un token para activar los envíos.',
      'ok',
    );
    await checkSync();
  } catch (error) {
    setConfigMessage(String(error?.message || error), 'error');
  }
}

saveButton.addEventListener('click', async () => {
  if (saveButton.disabled) return;
  saveButton.disabled = true;
  setConfigMessage('');
  try {
    if (await requestConnectionAuthorization()) await saveConfiguration();
  } finally {
    saveButton.disabled = false;
  }
});

document.getElementById('limpiar').addEventListener('click', async () => {
  if (!confirm('¿Eliminar la lista visual local de comprobantes?')) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  await loadReceipts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[STORAGE_KEY]) void loadReceipts();
  if (changes[QUEUE_KEY]) void checkSync();
  if (changes[CONFIG_KEY]) void loadConfiguration();
});

void (async () => {
  await loadConfiguration();
  await Promise.all([loadReceipts(), checkSync()]);
})();
