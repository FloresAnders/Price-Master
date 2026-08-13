(() => {
  'use strict';

  const STORAGE_KEY = 'ventasGenteCrystal';
  const syncCore = globalThis.TimeMasterGenteCrystalSync;
  const POLL_MS = 1200;
  const MUTATION_DEBOUNCE_MS = 300;
  const CAMBIO_SORTEO_ESPERA_MS = 1200;

  let mutationTimer = null;
  let suspenderHasta = 0;
  let inicializado = false;
  let ultimoAvisoTicket = null;
  let escaneando = false;

  function log(...args) {
    console.log('%c[TimeMaster]', 'color:#22c55e;font-weight:700', ...args);
  }

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getSelectSorteo() {
    const selects = [...document.querySelectorAll('select')];
    if (!selects.length) return null;

    const porId = selects.find((s) => /sorteo/i.test(s.id || ''));
    if (porId) return porId;

    const porName = selects.find((s) => /sorteo/i.test(s.name || ''));
    if (porName) return porName;

    // Busca un label o contenedor cercano cuyo texto sea "Sorteo".
    for (const select of selects) {
      let nodo = select.parentElement;
      for (let nivel = 0; nodo && nivel < 3; nivel++, nodo = nodo.parentElement) {
        const texto = normalizar(nodo.textContent);
        if (/(^|\s)sorteo\s*:/.test(texto) || texto.startsWith('sorteo')) {
          return select;
        }
      }
    }

    // En la pantalla actual de entradas.php el sorteo es el primer select.
    return selects[0];
  }

  function getSorteo() {
    const select = getSelectSorteo();
    if (!select || select.selectedIndex < 0) return null;
    return (select.options[select.selectedIndex]?.textContent || '').trim() || null;
  }

  function extraerTicket(texto) {
    // Formato observado: 41787-2204-59175789
    const match = String(texto || '').match(/\b\d{4,}-\d{2,}-\d{5,}\b/);
    return match ? match[0] : null;
  }

  function extraerMonto(texto) {
    const value = String(texto || '');
    const matches = [...value.matchAll(/[₡¢]\s*([\d.,]+)/g)];
    if (!matches.length) return 0;

    const raw = matches[matches.length - 1][1];
    const digits = raw.replace(/[^\d]/g, '');
    const monto = Number(digits || 0);
    return Number.isFinite(monto) ? monto : 0;
  }

  function extraerFechaHora(texto) {
    const value = String(texto || '');
    const match = value.match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\b/i
    );

    if (!match) return null;

    const [, ddRaw, mmRaw, yyyy, hhRaw, min, secRaw = '00', apRaw] = match;
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
      Number(secRaw)
    ).getTime();

    return {
      fecha: `${dd}/${mm}/${yyyy}`,
      hora: `${hhRaw.padStart(2, '0')}:${min}${secRaw !== '00' ? `:${secRaw}` : ''} ${ap}`,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
    };
  }

  function filaTexto(fila) {
    return (fila?.innerText || fila?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function colorEsRojoDeBorrado(color) {
    const match = String(color || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!match) return false;

    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    const a = match[4] === undefined ? 1 : Number(match[4]);

    if (a === 0) return false;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Gente Crystal pinta los tiquetes borrados con un fondo rojo/rosado.
    // Aceptamos tanto rojos fuertes como los tonos "danger" claros de Bootstrap.
    return (
      r >= 150 &&
      r === max &&
      delta >= 12 &&
      r >= g + 10 &&
      r >= b + 10
    );
  }

  function esFilaBorrada(fila) {
    if (!fila) return false;

    // 1) Texto visible o accesible.
    const texto = normalizar(filaTexto(fila));
    if (/\b(borrad[oa]?|eliminad[oa]?|anulad[oa]?|cancelad[oa]?)\b/.test(texto)) {
      return true;
    }

    // 2) Clases/atributos que suelen marcar estados de borrado.
    const nodos = [fila, ...fila.querySelectorAll('*')];
    const patronEstado = /(borrad|eliminad|anulad|cancelad|deleted|removed|danger)/i;

    for (const nodo of nodos) {
      const tokens = [
        nodo.className,
        nodo.id,
        nodo.getAttribute?.('title'),
        nodo.getAttribute?.('aria-label'),
        nodo.getAttribute?.('data-status'),
        nodo.getAttribute?.('data-estado')
      ]
        .filter(Boolean)
        .join(' ');

      if (patronEstado.test(tokens)) return true;
    }

    // 3) En esta pantalla Gente Crystal también identifica el borrado por el
    //    fondo rojo de toda la fila, aun cuando la palabra "Borrado" no aparece.
    const elementosColor = [fila, ...fila.querySelectorAll('td')];
    for (const elemento of elementosColor) {
      try {
        const color = getComputedStyle(elemento).backgroundColor;
        if (colorEsRojoDeBorrado(color)) return true;
      } catch (_error) {
        // Ignorar nodos que ya no estén conectados al DOM.
      }
    }

    return false;
  }

  function detectarTablaPorTiquetes() {
    // No depende de <thead>. Busca cualquier tabla que contenga al menos una
    // fila con un número de tiquete real.
    const tablas = [...document.querySelectorAll('table')];

    for (const tabla of tablas) {
      const filas = [...tabla.querySelectorAll('tr')];
      if (filas.some((fila) => extraerTicket(filaTexto(fila)))) {
        return tabla;
      }
    }

    return null;
  }

  function leerTiquetesVisibles() {
    const tabla = detectarTablaPorTiquetes();
    if (!tabla) {
      return {
        ventas: [],
        borrados: [],
        diagnostico: { tablaEncontrada: false, filas: 0, filasConTicket: 0 }
      };
    }

    const filas = [...tabla.querySelectorAll('tr')];
    const ventas = [];
    const borrados = [];
    let actual = null;
    let filasConTicket = 0;

    const finalizar = () => {
      if (!actual) return;
      if (actual.ticket && actual.monto > 0) ventas.push(actual);
      actual = null;
    };

    for (const fila of filas) {
      const texto = filaTexto(fila);
      if (!texto) continue;

      const ticket = extraerTicket(texto);
      const borrado = esFilaBorrada(fila);
      const monto = extraerMonto(texto);
      const fechaHora = extraerFechaHora(texto);

      if (ticket) {
        filasConTicket += 1;
        finalizar();

        if (borrado) {
          borrados.push(ticket);
          continue;
        }

        actual = {
          ticket,
          monto,
          fecha: fechaHora?.fecha || null,
          hora: fechaHora?.hora || null,
          timestamp: fechaHora?.timestamp || Date.now()
        };
        continue;
      }

      // Las filas de continuación de un mismo tiquete no repiten el número
      // de tiquete. Mientras no aparezca el siguiente tiquete, acumulamos monto.
      if (actual && !borrado && monto > 0) {
        actual.monto += monto;

        if (!actual.hora && fechaHora) {
          actual.fecha = fechaHora.fecha;
          actual.hora = fechaHora.hora;
          actual.timestamp = fechaHora.timestamp;
        }
      }
    }

    finalizar();

    return {
      ventas,
      borrados,
      diagnostico: {
        tablaEncontrada: true,
        filas: filas.length,
        filasConTicket,
        ventasValidas: ventas.length,
        borrados: borrados.length
      }
    };
  }

  async function obtenerGuardadas() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }

  async function encolarEventos(eventos) {
    if (!eventos.length) return true;
    if (!syncCore) {
      console.error('[TimeMaster] No se cargÃ³ el nÃºcleo de sincronizaciÃ³n.');
      return false;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TM_GC_QUEUE_SALES',
        events: eventos
      });
      if (!response?.ok) {
        throw new Error(response?.error || 'No se pudo guardar la cola.');
      }
      return true;
    } catch (error) {
      console.error('[TimeMaster] No se pudieron encolar las ventas:', error);
      return false;
    }
  }

  function horaFallback() {
    return new Date().toLocaleTimeString('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function fechaFallback() {
    return new Date().toLocaleDateString('es-CR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  function mostrarAviso(venta) {
    document.getElementById('tm-gc-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'tm-gc-toast';
    toast.style.cssText = [
      'position:fixed',
      'right:22px',
      'bottom:22px',
      'z-index:2147483647',
      'background:#0f172a',
      'color:white',
      'border:1px solid #334155',
      'border-radius:10px',
      'padding:12px 14px',
      'font:13px Arial,sans-serif',
      'box-shadow:0 10px 30px rgba(0,0,0,.35)',
      'max-width:460px'
    ].join(';');

    const titulo = document.createElement('div');
    titulo.textContent = '✓ TimeMaster detectó una venta';
    titulo.style.cssText = 'font-weight:700;color:#4ade80;margin-bottom:6px';

    const detalle = document.createElement('div');
    detalle.textContent = `${venta.hora} · ${venta.sorteo} · ₡${Number(venta.monto).toLocaleString('es-CR')}`;

    toast.append(titulo, detalle);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  async function sincronizarDesdeTabla({ avisarNuevas = true, forzar = false } = {}) {
    if (escaneando) return { ok: false, motivo: 'escaneando' };
    if (!forzar && Date.now() < suspenderHasta) return { ok: false, motivo: 'cambio_sorteo' };

    escaneando = true;

    try {
      const sorteo = getSorteo();
      const lectura = leerTiquetesVisibles();
      const { ventas: visibles, borrados, diagnostico } = lectura;

      if (!sorteo) {
        return { ok: false, motivo: 'sin_sorteo', sorteo: null, diagnostico };
      }

      const guardadas = await obtenerGuardadas();
      const porTicket = new Map();
      const heredadas = [];

      for (const venta of guardadas) {
        if (venta.ticket) porTicket.set(venta.ticket, venta);
        else heredadas.push(venta);
      }

      let cambio = false;
      const nuevas = [];
      const eventos = [];

      for (const ticket of borrados) {
        eventos.push(syncCore.buildDeletedPayload(ticket));
        if (porTicket.delete(ticket)) cambio = true;
      }

      for (const item of visibles) {
        const existente = porTicket.get(item.ticket);
        const venta = {
          id: existente?.id || `GC-${item.ticket}`,
          ticket: item.ticket,
          sorteo: existente?.sorteo || sorteo,
          monto: item.monto,
          fecha: item.fecha || existente?.fecha || fechaFallback(),
          hora: item.hora || existente?.hora || horaFallback(),
          timestamp: item.timestamp || existente?.timestamp || Date.now()
        };

        if (!existente) {
          porTicket.set(item.ticket, venta);
          nuevas.push(venta);
          cambio = true;
        } else {
          // No cambiamos el sorteo de un ticket ya registrado solo porque el
          // usuario cambió el selector después. Sí actualizamos monto/fecha/hora.
          const actualizado = { ...existente, ...venta, sorteo: existente.sorteo || sorteo };
          if (
            existente.monto !== actualizado.monto ||
            existente.hora !== actualizado.hora ||
            existente.fecha !== actualizado.fecha
          ) {
            porTicket.set(item.ticket, actualizado);
            cambio = true;
          }
        }

        eventos.push(syncCore.buildActivePayload(porTicket.get(item.ticket)));
      }

      if (cambio) {
        const resultado = [...heredadas, ...porTicket.values()].sort(
          (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
        );
        await chrome.storage.local.set({ [STORAGE_KEY]: resultado });
      }

      const colaActualizada = await encolarEventos(eventos);

      if (avisarNuevas && inicializado && nuevas.length) {
        const ultima = [...nuevas].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        if (ultima.ticket !== ultimoAvisoTicket) {
          ultimoAvisoTicket = ultima.ticket;
          mostrarAviso(ultima);
        }
      }

      if (nuevas.length) log('Ventas nuevas:', nuevas);

      return {
        ok: true,
        sorteo,
        nuevas: nuevas.length,
        guardadas: (await obtenerGuardadas()).length,
        colaActualizada,
        diagnostico
      };
    } catch (error) {
      console.error('[TimeMaster] Error escaneando ventas:', error);
      return { ok: false, motivo: 'error', error: String(error?.message || error) };
    } finally {
      escaneando = false;
    }
  }

  function configurarCambioSorteo() {
    const select = getSelectSorteo();
    if (!select || select.dataset.tmGcV3Listener === '1') return;

    select.dataset.tmGcV3Listener = '1';
    select.addEventListener('change', () => {
      suspenderHasta = Date.now() + CAMBIO_SORTEO_ESPERA_MS;
      setTimeout(() => {
        sincronizarDesdeTabla({ avisarNuevas: false, forzar: true });
      }, CAMBIO_SORTEO_ESPERA_MS + 150);
    });
  }

  function iniciarObserver() {
    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        configurarCambioSorteo();
        sincronizarDesdeTabla({ avisarNuevas: true });
      }, MUTATION_DEBOUNCE_MS);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'TM_FORCE_SCAN') {
      sincronizarDesdeTabla({ avisarNuevas: false, forzar: true }).then(sendResponse);
      return true;
    }

    if (message?.type === 'TM_STATUS') {
      const lectura = leerTiquetesVisibles();
      obtenerGuardadas().then((ventas) => {
        sendResponse({
          ok: true,
          version: '1.4.0',
          sorteo: getSorteo(),
          guardadas: ventas.length,
          diagnostico: lectura.diagnostico
        });
      });
      return true;
    }
  });

  async function iniciar() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (!Array.isArray(result[STORAGE_KEY])) {
      await chrome.storage.local.set({ [STORAGE_KEY]: [] });
    }

    configurarCambioSorteo();
    iniciarObserver();

    setTimeout(async () => {
      const resultado = await sincronizarDesdeTabla({ avisarNuevas: false, forzar: true });
      inicializado = true;
      log('Extensión v1.3 activa:', resultado);
    }, 600);

    setInterval(() => {
      configurarCambioSorteo();
      sincronizarDesdeTabla({ avisarNuevas: true });
    }, POLL_MS);
  }

  iniciar().catch((error) => console.error('[TimeMaster] Error al iniciar:', error));
})();
