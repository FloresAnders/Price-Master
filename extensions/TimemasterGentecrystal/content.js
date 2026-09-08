(() => {
  'use strict';

  const STORAGE_KEY = 'ventasGenteCrystal';
  const CONFIRMED_LOCAL_TICKETS_KEY = 'genteCrystalConfirmedLocalTickets';
  const PENDING_LOCAL_CONFIRMATIONS_KEY =
    'genteCrystalPendingLocalConfirmations';
  const syncCore = globalThis.TimeMasterGenteCrystalSync;
  const runSerializedPageOperation = syncCore.createSerializedRunner();
  const POLL_MS = 1200;
  const MUTATION_DEBOUNCE_MS = 300;
  const CAMBIO_SORTEO_ESPERA_MS = 1200;

  let mutationTimer = null;
  let cambioSorteoTimer = null;
  let inicioTimer = null;
  let pollTimer = null;
  let observer = null;
  let suspenderHasta = 0;
  let escaneando = false;
  let contextoInvalidado = false;
  let intencionesVentaLocal = [];
  let confirmacionesVentaPendientes = [];
  const firmasModalesProcesados = new Set();

  function log(...args) {
    console.log('%c[TimeMaster]', 'color:#22c55e;font-weight:700', ...args);
  }

  function detenerPorContextoInvalidado() {
    contextoInvalidado = true;
    clearTimeout(mutationTimer);
    clearTimeout(cambioSorteoTimer);
    clearTimeout(inicioTimer);
    clearInterval(pollTimer);
    observer?.disconnect();
    document.removeEventListener('click', detectarClicIngresarVenta, true);
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

  function hasSorteo(value) {
    const normalized = String(value || '').trim();
    return Boolean(normalized) && normalized.toUpperCase() !== 'SIN SORTEO';
  }

  function extraerTicket(texto) {
    return syncCore.extractPrintedTicketId(texto);
  }

  function extraerMonto(texto) {
    const value = String(texto || '');
    const matches = [...value.matchAll(/[₡¢]\s*([\d.,]+)/g)];
    if (!matches.length) return 0;
    return syncCore.parseDisplayedMoney(matches[matches.length - 1][1]);
  }

  function extraerFechaHora(texto) {
    return syncCore.parseObservedSaleDateTime(texto);
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

  function detectarContenedorTiquetes() {
    // Nueva pantalla de ventas: los tiquetes viven en tarjetas
    // (.sales-history-card) dentro de #sales-history-panel, sin <table>.
    const panel = document.querySelector('#sales-history-panel');
    if (panel && panel.querySelector('.sales-history-card')) {
      return panel;
    }

    // Pantalla anterior: cualquier tabla con al menos una fila que contenga
    // un número de tiquete real. No depende de <thead>.
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
    const contenedor = detectarContenedorTiquetes();
    if (!contenedor) {
      return {
        ventas: [],
        borrados: [],
        diagnostico: { tablaEncontrada: false, filas: 0, filasConTicket: 0 }
      };
    }

    // Nueva pantalla: lectura de tarjetas de historial de ventas.
    if (contenedor.querySelector('.sales-history-card')) {
      return syncCore.readSalesHistoryCards(contenedor);
    }

    const tabla = contenedor;
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
          timestamp: fechaHora?.timestamp || null,
          timestampPrecisionMs: fechaHora?.timestampPrecisionMs || null
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
          actual.timestampPrecisionMs = fechaHora.timestampPrecisionMs;
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

  async function obtenerEstadoLocal() {
    const result = await chrome.storage.local.get([
      STORAGE_KEY,
      CONFIRMED_LOCAL_TICKETS_KEY,
      PENDING_LOCAL_CONFIRMATIONS_KEY,
    ]);
    return {
      ventas: Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [],
      confirmaciones: Array.isArray(result[CONFIRMED_LOCAL_TICKETS_KEY])
        ? result[CONFIRMED_LOCAL_TICKETS_KEY]
        : [],
      pendientes: Array.isArray(result[PENDING_LOCAL_CONFIRMATIONS_KEY])
        ? result[PENDING_LOCAL_CONFIRMATIONS_KEY]
        : [],
    };
  }

  async function obtenerGuardadas() {
    return (await obtenerEstadoLocal()).ventas;
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
      if (syncCore.isExtensionContextInvalidatedError(error)) throw error;
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

  async function registrarVentasDesdeModal() {
    if (contextoInvalidado) return { ok: false, motivo: 'contexto_invalidado' };

    const ventasModal = syncCore.readSalesSuccessModal(document);
    if (!ventasModal.length) return { ok: false, motivo: 'sin_modal_completo' };

    const firma = ventasModal
      .map((venta) => `${venta.ticket}:${venta.sorteo}:${venta.monto}`)
      .join('|');
    if (firmasModalesProcesados.has(firma)) {
      return { ok: true, capturadas: 0, motivo: 'modal_procesado' };
    }

    try {
      const ahora = Date.now();
      const estadoLocal = await obtenerEstadoLocal();
      const esNuevaConfirmacion = syncCore.isNewSalesSuccessConfirmation(
        estadoLocal.ventas,
        ventasModal,
      );
      const ventasActualizadas = syncCore.upsertSalesSuccessRecords(
        estadoLocal.ventas,
        ventasModal,
        {
          timestamp: ahora,
          fecha: fechaFallback(),
          hora: horaFallback(),
        },
      );
      const porTicket = new Map(
        ventasActualizadas.map((venta) => [venta.ticket, venta]),
      );
      const ventasCapturadas = ventasModal.map((venta) =>
        porTicket.get(venta.ticket),
      );
      const pendientesActualizados = esNuevaConfirmacion
        ? estadoLocal.pendientes.slice(1)
        : estadoLocal.pendientes;
      const eventos = ventasCapturadas.map((venta) =>
        syncCore.buildActivePayload(venta),
      );

      await chrome.storage.local.set({
        [STORAGE_KEY]: ventasActualizadas,
        [PENDING_LOCAL_CONFIRMATIONS_KEY]: pendientesActualizados,
      });
      confirmacionesVentaPendientes = pendientesActualizados;
      if (esNuevaConfirmacion) {
        intencionesVentaLocal = intencionesVentaLocal.slice(1);
      }

      const colaActualizada = await encolarEventos(eventos);
      if (!colaActualizada) {
        return { ok: false, motivo: 'cola_no_actualizada' };
      }

      firmasModalesProcesados.add(firma);
      if (firmasModalesProcesados.size > 50) {
        const primeraFirma = firmasModalesProcesados.values().next().value;
        firmasModalesProcesados.delete(primeraFirma);
      }

      log('Venta confirmada desde el modal:', ventasCapturadas);

      return {
        ok: true,
        capturadas: ventasCapturadas.length,
        colaActualizada,
      };
    } catch (error) {
      if (syncCore.isExtensionContextInvalidatedError(error)) {
        detenerPorContextoInvalidado();
        return { ok: false, motivo: 'contexto_invalidado' };
      }
      console.error(
        '[TimeMaster] No se pudo registrar la venta desde el modal:',
        error,
      );
      return { ok: false, motivo: 'error', error: String(error?.message || error) };
    }
  }

  function detectarClicIngresarVenta(event) {
    const objetivo = event.target;
    if (!(objetivo instanceof Element)) return;

    const control = objetivo.closest(
      'button, input[type="button"], input[type="submit"], a, [role="button"]'
    );
    if (!control) return;

    if (!syncCore.isIngresarVentaControl({
      id: control.id,
      ariaLabel: control.getAttribute('aria-label'),
      value: control instanceof HTMLInputElement ? control.value : '',
      text:
        control.innerText ||
        control.textContent ||
        control.getAttribute('title'),
    })) return;

    const lectura = leerTiquetesVisibles();
    const ahora = Date.now();
    const ticketsAntesDelClic = [
      ...lectura.ventas.map((venta) => venta.ticket),
      ...lectura.borrados,
    ];
    void runSerializedPageOperation(async () => {
      intencionesVentaLocal = syncCore.appendLocalSaleIntent(
        intencionesVentaLocal,
        ticketsAntesDelClic,
        ahora,
      );
      const result = await chrome.storage.local.get(
        PENDING_LOCAL_CONFIRMATIONS_KEY,
      );
      confirmacionesVentaPendientes =
        syncCore.appendPendingLocalConfirmation(
          result[PENDING_LOCAL_CONFIRMATIONS_KEY],
          ahora,
        );
      await chrome.storage.local.set({
        [PENDING_LOCAL_CONFIRMATIONS_KEY]: confirmacionesVentaPendientes,
      });
    })
      .catch((error) => {
        if (syncCore.isExtensionContextInvalidatedError(error)) return;
        console.error(
          '[TimeMaster] No se pudo registrar la venta pendiente:',
          error,
        );
      });
  }

  async function sincronizarDesdeTabla({ forzar = false } = {}) {
    if (contextoInvalidado) return { ok: false, motivo: 'contexto_invalidado' };
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

      const estadoLocal = await obtenerEstadoLocal();
      const guardadas = estadoLocal.ventas;
      const confirmaciones = estadoLocal.confirmaciones;
      const pendientes = estadoLocal.pendientes;
      const porTicket = new Map();
      const heredadas = [];

      for (const venta of guardadas) {
        if (venta.ticket) porTicket.set(venta.ticket, venta);
        else heredadas.push(venta);
      }

      let cambio = false;
      const nuevas = [];
      const eventos = [];

      const preparacion = syncCore.prepareNewSalesForPrintConfirmation(
        visibles.filter((item) => !porTicket.has(item.ticket)),
        confirmaciones,
        pendientes,
        Date.now(),
      );
      confirmacionesVentaPendientes = preparacion.pendingConfirmations;
      const ticketsDiferidos = new Set(
        preparacion.deferredSales.map((venta) => venta.ticket),
      );
      const clasificacion = syncCore.classifyNewSales(
        preparacion.readySales,
        intencionesVentaLocal,
        Date.now(),
        confirmaciones,
      );
      intencionesVentaLocal = clasificacion.intents;
      const origenPorTicket = new Map(
        clasificacion.sales.map((venta) => [venta.ticket, venta.captureOrigin])
      );

      for (const ticket of borrados) {
        eventos.push(syncCore.buildDeletedPayload(ticket));
        if (porTicket.delete(ticket)) cambio = true;
      }

      for (const item of visibles) {
        const existente = porTicket.get(item.ticket);
        if (!existente && ticketsDiferidos.has(item.ticket)) continue;
        const sorteoExistente = hasSorteo(existente?.sorteo)
          ? existente.sorteo
          : '';
        // Las tarjetas de la nueva pantalla muestran el sorteo de cada tiquete;
        // se prefiere sobre el selector cuando está disponible.
        const sorteoTarjeta = hasSorteo(item.sorteo) ? item.sorteo : '';
        const venta = {
          id: existente?.id || `GC-${item.ticket}`,
          ticket: item.ticket,
          sorteo: sorteoExistente || sorteoTarjeta || sorteo,
          monto: item.monto,
          fecha: item.fecha || existente?.fecha || fechaFallback(),
          hora: item.hora || existente?.hora || horaFallback(),
          captureOrigin:
            existente?.captureOrigin ||
            origenPorTicket.get(item.ticket) ||
            'indirect',
          timestamp: syncCore.resolveStableSaleTimestamp(
            item.timestamp,
            existente?.timestamp,
            Date.now()
          )
        };

        if (!existente) {
          porTicket.set(item.ticket, venta);
          nuevas.push(venta);
          cambio = true;
        } else {
          // No cambiamos el sorteo de un ticket ya registrado solo porque el
          // usuario cambió el selector después. Sí actualizamos monto/fecha/hora.
          const actualizado = {
            ...existente,
            ...venta,
            sorteo: sorteoExistente || sorteoTarjeta || sorteo,
          };
          if (
            existente.sorteo !== actualizado.sorteo ||
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

      const cambiosStorage = {};
      if (cambio) {
        const resultado = [...heredadas, ...porTicket.values()].sort(
          (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
        );
        cambiosStorage[STORAGE_KEY] = resultado;
      }
      if (
        JSON.stringify(clasificacion.confirmedTickets) !==
        JSON.stringify(confirmaciones)
      ) {
        cambiosStorage[CONFIRMED_LOCAL_TICKETS_KEY] =
          clasificacion.confirmedTickets;
      }
      if (
        JSON.stringify(preparacion.pendingConfirmations) !==
        JSON.stringify(pendientes)
      ) {
        cambiosStorage[PENDING_LOCAL_CONFIRMATIONS_KEY] =
          preparacion.pendingConfirmations;
      }
      if (Object.keys(cambiosStorage).length) {
        await chrome.storage.local.set(cambiosStorage);
      }

      const colaActualizada = await encolarEventos(eventos);

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
      if (syncCore.isExtensionContextInvalidatedError(error)) {
        detenerPorContextoInvalidado();
        return { ok: false, motivo: 'contexto_invalidado' };
      }
      console.error('[TimeMaster] Error escaneando ventas:', error);
      return { ok: false, motivo: 'error', error: String(error?.message || error) };
    } finally {
      escaneando = false;
    }
  }

  function escanearPagina({ forzar = false } = {}) {
    return runSerializedPageOperation(async () => {
      await registrarVentasDesdeModal();
      return sincronizarDesdeTabla({ forzar });
    });
  }

  function configurarCambioSorteo() {
    if (contextoInvalidado) return;
    const select = getSelectSorteo();
    if (!select || select.dataset.tmGcV3Listener === '1') return;

    select.dataset.tmGcV3Listener = '1';
    select.addEventListener('change', () => {
      suspenderHasta = Date.now() + CAMBIO_SORTEO_ESPERA_MS;
      clearTimeout(cambioSorteoTimer);
      cambioSorteoTimer = setTimeout(() => {
        if (contextoInvalidado) return;
        void escanearPagina({ forzar: true });
      }, CAMBIO_SORTEO_ESPERA_MS + 150);
    });
  }

  function iniciarObserver() {
    observer = new MutationObserver(() => {
      if (contextoInvalidado) return;
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(() => {
        configurarCambioSorteo();
        void escanearPagina();
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
      escanearPagina({ forzar: true }).then(sendResponse);
      return true;
    }

    if (message?.type === 'TM_STATUS') {
      const lectura = leerTiquetesVisibles();
      obtenerGuardadas().then((ventas) => {
        sendResponse({
          ok: true,
          version: '1.11.3',
          sorteo: getSorteo(),
          guardadas: ventas.length,
          diagnostico: lectura.diagnostico
        });
      });
      return true;
    }
  });

  async function iniciar() {
    const result = await chrome.storage.local.get([
      STORAGE_KEY,
      CONFIRMED_LOCAL_TICKETS_KEY,
      PENDING_LOCAL_CONFIRMATIONS_KEY,
    ]);
    const estadoInicial = {};
    if (!Array.isArray(result[STORAGE_KEY])) {
      estadoInicial[STORAGE_KEY] = [];
    }
    if (!Array.isArray(result[CONFIRMED_LOCAL_TICKETS_KEY])) {
      estadoInicial[CONFIRMED_LOCAL_TICKETS_KEY] = [];
    }
    confirmacionesVentaPendientes = Array.isArray(
      result[PENDING_LOCAL_CONFIRMATIONS_KEY],
    )
      ? result[PENDING_LOCAL_CONFIRMATIONS_KEY]
      : [];
    if (!Array.isArray(result[PENDING_LOCAL_CONFIRMATIONS_KEY])) {
      estadoInicial[PENDING_LOCAL_CONFIRMATIONS_KEY] = [];
    }
    if (Object.keys(estadoInicial).length) {
      await chrome.storage.local.set(estadoInicial);
    }

    configurarCambioSorteo();
    document.addEventListener('click', detectarClicIngresarVenta, true);
    iniciarObserver();

    inicioTimer = setTimeout(async () => {
      if (contextoInvalidado) return;
      const resultado = await escanearPagina({ forzar: true });
      if (resultado.motivo === 'contexto_invalidado') return;
      log('Extensión v1.11.3 activa:', resultado);
    }, 600);

    pollTimer = setInterval(() => {
      if (contextoInvalidado) return;
      configurarCambioSorteo();
      void escanearPagina();
    }, POLL_MS);
  }

  iniciar().catch((error) => {
    if (syncCore?.isExtensionContextInvalidatedError(error)) {
      detenerPorContextoInvalidado();
      return;
    }
    console.error('[TimeMaster] Error al iniciar:', error);
  });
})();
