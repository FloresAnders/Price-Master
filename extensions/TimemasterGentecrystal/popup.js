const STORAGE_KEY = 'ventasGenteCrystal';
const CONFIG_KEY = 'genteCrystalIntegrationConfig';
const QUEUE_KEY = 'genteCrystalSyncQueue';
const syncCore = globalThis.TimeMasterGenteCrystalSync;

const tbody = document.getElementById('ventas');
const vacio = document.getElementById('vacio');
const contador = document.getElementById('contador');
const estado = document.getElementById('estado');
const apiUrlInput = document.getElementById('api-url');
const deviceTokenInput = document.getElementById('device-token');
const syncStatus = document.getElementById('sync-status');
const syncIndicator = document.getElementById('sync-indicator');
const configMessage = document.getElementById('config-message');
const saveConfigButton = document.getElementById('guardar-config');
const passwordDialog = document.getElementById('connection-password-dialog');
const passwordForm = document.getElementById('connection-password-form');
const passwordInput = document.getElementById('connection-password');
const passwordError = document.getElementById('connection-password-error');
const cancelPasswordButton = document.getElementById('cancelar-password');

function formatMonto(value) {
  return `₡${Number(value || 0).toLocaleString('es-CR')}`;
}

function crearCelda(texto, clase = '') {
  const td = document.createElement('td');
  td.textContent = texto;
  if (clase) td.className = clase;
  return td;
}

function setEstado(texto, tipo = '') {
  estado.textContent = texto;
  estado.className = `status ${tipo}`.trim();
}

function setConfigMessage(texto, tipo = '') {
  configMessage.textContent = texto;
  configMessage.className = `config-message ${tipo}`.trim();
}

async function cargarConfiguracion() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  const config = result[CONFIG_KEY] || {};
  apiUrlInput.value = config.apiBaseUrl || 'https://www.timemaster.es';
  deviceTokenInput.value = typeof config.token === 'string' ? config.token : '';
}

async function comprobarSincronizacion() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TM_GC_SYNC_STATUS'
    });
    if (!response?.ok) throw new Error(response?.error || 'Sin respuesta');

    const queue = response.queue || {};
    syncStatus.textContent = [
      `${queue.pending || 0} pendientes`,
      `${queue.sending || 0} enviando`,
      `${queue.synced || 0} sincronizados`,
      `${queue.error || 0} con error`
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

async function guardarConfiguracion() {
  setConfigMessage('Guardando…');

  try {
    const apiBaseUrl = syncCore.normalizeApiBaseUrl(apiUrlInput.value);
    const token = deviceTokenInput.value.trim();
    if (token && !/^tm_gc_[A-Za-z0-9_-]{8,160}$/.test(token)) {
      throw new Error('El token debe comenzar con tm_gc_.');
    }

    await chrome.storage.local.set({
      [CONFIG_KEY]: { apiBaseUrl, token }
    });
    const response = await chrome.runtime.sendMessage({
      type: 'TM_GC_CONFIG_UPDATED'
    });
    if (!response?.ok) {
      throw new Error(response?.error || 'No se pudo activar la conexión.');
    }

    apiUrlInput.value = apiBaseUrl;
    setConfigMessage(
      token ? 'Conexión guardada. La cola se enviará automáticamente.' : 'URL guardada. Agrega un token para activar los envíos.',
      'ok'
    );
    await comprobarSincronizacion();
  } catch (error) {
    setConfigMessage(String(error?.message || error), 'error');
  }
}

function solicitarAutorizacionConexion() {
  passwordInput.value = '';
  passwordError.textContent = '';
  passwordDialog.returnValue = '';

  return new Promise((resolve) => {
    const finalizar = () => {
      passwordForm.removeEventListener('submit', confirmar);
      cancelPasswordButton.removeEventListener('click', cancelar);
      passwordInput.value = '';
      resolve(passwordDialog.returnValue === 'authorized');
    };

    const confirmar = (event) => {
      event.preventDefault();
      if (!syncCore.isConnectionSaveAuthorized(passwordInput.value)) {
        passwordInput.value = '';
        passwordError.textContent = 'Contraseña incorrecta.';
        passwordInput.focus();
        return;
      }
      passwordDialog.close('authorized');
    };

    const cancelar = () => passwordDialog.close('cancelled');

    passwordForm.addEventListener('submit', confirmar);
    cancelPasswordButton.addEventListener('click', cancelar);
    passwordDialog.addEventListener('close', finalizar, { once: true });
    passwordDialog.showModal();
    passwordInput.focus();
  });
}

async function autorizarYGuardarConfiguracion() {
  if (saveConfigButton.disabled) return;
  saveConfigButton.disabled = true;
  setConfigMessage('');

  try {
    const autorizado = await solicitarAutorizacionConexion();
    if (autorizado) await guardarConfiguracion();
  } finally {
    saveConfigButton.disabled = false;
  }
}

async function cargarLista() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const ventas = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];

  contador.textContent = String(ventas.length);
  tbody.replaceChildren();

  const ordenadas = [...ventas].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  vacio.style.display = ordenadas.length ? 'none' : 'block';

  for (const venta of ordenadas) {
    const tr = document.createElement('tr');
    tr.title = venta.ticket ? `Tiquete: ${venta.ticket}` : '';
    tr.append(
      crearCelda(venta.hora || '-', 'time'),
      crearCelda(venta.sorteo || '-', 'draw'),
      crearCelda(formatMonto(venta.monto), 'right amount')
    );
    tbody.appendChild(tr);
  }
}

async function getTabActivo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function enviarMensaje(tipo) {
  const tab = await getTabActivo();
  if (!tab?.id) throw new Error('No se encontró la pestaña activa.');
  return chrome.tabs.sendMessage(tab.id, { type: tipo });
}

async function comprobarEstado() {
  try {
    const respuesta = await enviarMensaje('TM_STATUS');
    const d = respuesta?.diagnostico || {};

    if (!respuesta?.ok) {
      setEstado('El detector respondió, pero no pudo leer la página.', 'warn');
      return;
    }

    if (!d.tablaEncontrada) {
      setEstado(`Detector v${respuesta.version} conectado · Sorteo: ${respuesta.sorteo || '-'} · No encontró la tabla de tiquetes`, 'warn');
      return;
    }

    const borrados = d.borrados || 0;
    const detalleBorrados = borrados ? ` · ${borrados} borrado${borrados === 1 ? '' : 's'} ignorado${borrados === 1 ? '' : 's'}` : '';

    setEstado(
      `Detector v${respuesta.version} conectado · ${respuesta.sorteo || '-'} · ${d.filasConTicket || 0} tiquetes visibles${detalleBorrados} · ${respuesta.guardadas || 0} guardados`,
      'ok'
    );
  } catch (_error) {
    setEstado('No hay conexión con Gente Crystal. Recarga entradas.php después de actualizar la extensión.', 'error');
  }
}

async function escanearAhora() {
  setEstado('Escaneando la tabla…');

  try {
    const respuesta = await enviarMensaje('TM_FORCE_SCAN');
    await cargarLista();
    await comprobarSincronizacion();

    if (!respuesta?.ok) {
      setEstado(`No se pudo escanear: ${respuesta?.motivo || 'error desconocido'}`, 'warn');
      return;
    }

    const d = respuesta.diagnostico || {};
    const borrados = d.borrados || 0;
    const detalleBorrados = borrados ? ` · ${borrados} borrado${borrados === 1 ? '' : 's'} ignorado${borrados === 1 ? '' : 's'}` : '';

    setEstado(
      `Escaneo listo · ${respuesta.sorteo || '-'} · ${d.filasConTicket || 0} tiquetes visibles${detalleBorrados} · ${respuesta.guardadas || 0} guardados`,
      'ok'
    );
  } catch (_error) {
    setEstado('No pude comunicarme con la página. Recarga Gente Crystal y vuelve a intentar.', 'error');
  }
}

document.getElementById('recargar').addEventListener('click', escanearAhora);
saveConfigButton.addEventListener('click', autorizarYGuardarConfiguracion);

document.getElementById('limpiar').addEventListener('click', async () => {
  if (!confirm('¿Eliminar todas las ventas guardadas por la extensión?')) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  await cargarLista();
  await comprobarEstado();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[STORAGE_KEY]) cargarLista();
  if (changes[QUEUE_KEY]) comprobarSincronizacion();
  if (changes[CONFIG_KEY]) cargarConfiguracion();
});

(async () => {
  await cargarConfiguracion();
  await Promise.all([
    cargarLista(),
    comprobarEstado(),
    comprobarSincronizacion()
  ]);
})();
