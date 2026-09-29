(function initTimeMasterCollector() {
  'use strict';

  if (globalThis.__leerRegistroTimeMasterLoaded) return;
  globalThis.__leerRegistroTimeMasterLoaded = true;

  const Core = globalThis.LeerRegistroCore;
  const BUTTON_ID = 'leer-registro-cargar-datos';
  const STATUS_ID = 'leer-registro-estado';
  let activeLoadRequestId = 0;

  function getTiemposDateInput() {
    return Array.from(document.querySelectorAll('label')).find((label) => {
      const span = label.querySelector('span');
      return Core.normalizeText(span?.textContent) === 'fecha';
    })?.querySelector('input[type="date"]') || null;
  }

  function getUpdateButton() {
    return Core.findByText(getTiemposPanel(), 'button', 'Actualizar');
  }

  function getTiemposPanel() {
    const dateInput = getTiemposDateInput();
    return dateInput?.closest('div.space-y-4') || document;
  }

  function getTotalSold() {
    const label = Array.from(getTiemposPanel().querySelectorAll('div')).find(
      (element) =>
        Core.isVisible(element) &&
        Core.normalizeText(element.textContent) === 'total vendido',
    );
    if (!label) return null;

    const card = label.parentElement;
    const amountElement = card?.querySelector('p');
    return Core.parseMoney(amountElement?.textContent);
  }

  function getTiemposError() {
    const alert = Array.from(
      getTiemposPanel().querySelectorAll('[role="alert"]'),
    ).find(Core.isVisible);
    return String(alert?.textContent || '').trim();
  }

  function getUpdateAvailabilityMessage() {
    const button = getUpdateButton();
    const tooltipId = button?.getAttribute('aria-describedby');
    const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
    return String(tooltip?.textContent || '').trim();
  }

  function clearTimeFilters() {
    const panel = getTiemposPanel();
    for (const input of panel.querySelectorAll('input[type="time"]')) {
      Core.setNativeValue(input, '');
    }
  }

  async function collectTiemposTotal(requestedAt) {
    if (location.hash !== '#tiempostucan') {
      throw new Error('La pestaña auxiliar no está en el reporte de Tiempos.');
    }

    const dateInput = await Core.waitFor(getTiemposDateInput, {
      timeoutMs: 45000,
      message: 'No se encontró la fecha del reporte de Tiempos.',
    });
    const reportDate = Core.getReportDate(new Date(requestedAt));
    Core.setNativeValue(dateInput, Core.formatDateISO(reportDate));
    clearTimeFilters();

    await Core.waitFor(getUpdateButton, {
      message: 'No se encontró el botón Actualizar del reporte de Tiempos.',
    });

    let updateButton;
    try {
      updateButton = await Core.waitFor(
        () => {
          const currentButton = getUpdateButton();
          return currentButton && !currentButton.disabled ? currentButton : false;
        },
        {
          timeoutMs: 10000,
          message: 'El botón Actualizar sigue bloqueado.',
        },
      );
    } catch (_error) {
      const availability = getUpdateAvailabilityMessage();
      throw new Error(
        availability ||
          'El reporte de Tiempos solo puede actualizarse durante la ventana de cierre del turno D o N.',
      );
    }

    const previousTotal = getTotalSold();
    let observedRefresh = false;
    updateButton.click();
    const refreshedTotal = await Core.waitFor(
      () => {
        const currentButton = getUpdateButton();
        const total = getTotalSold();
        const currentError = getTiemposError();
        const buttonText = Core.normalizeText(currentButton?.textContent);

        if (currentButton?.disabled || buttonText.includes('actualizando')) {
          observedRefresh = true;
          return false;
        }

        if (observedRefresh && currentButton && currentError) {
          throw new Error(`TimeMaster rechazó la actualización: ${currentError}`);
        }

        const totalChanged = total !== null && total !== previousTotal;
        return currentButton && total !== null && (observedRefresh || totalChanged)
          ? total
          : false;
      },
      {
        timeoutMs: 60000,
        message: 'TimeMaster no mostró el Total vendido del reporte de Tiempos.',
      },
    );

    return { total: refreshedTotal, reportDate: Core.formatDateISO(reportDate) };
  }

  function getVerificationSection() {
    const heading = Array.from(document.querySelectorAll('h4')).find((element) =>
      Core.normalizeText(element.textContent).includes(
        'verificacion contica / tucan / tiempos',
      ),
    );
    return heading?.closest('section') || null;
  }

  function findAmountInputs(section) {
    const definitions = [
      ['r08', /\br08\b/],
      ['t11', /\bt11\b/],
      ['tucan', /\btucan\b/],
      ['tiempos', /\btiempos\b/],
    ];
    const labels = Array.from(section.querySelectorAll('label'));
    const inputs = {};

    for (const [key, pattern] of definitions) {
      const label = labels.find((candidate) =>
        pattern.test(Core.normalizeText(candidate.textContent)),
      );
      const input = label?.querySelector('input:not([readonly])');
      if (!input) return null;
      inputs[key] = input;
    }

    return inputs;
  }

  function setStatus(text, tone = 'neutral') {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  }

  function fillClosingInputs(data, expectedSection, expectedInputs) {
    if (
      !expectedSection?.isConnected ||
      expectedSection !== getVerificationSection() ||
      Object.values(expectedInputs || {}).some((input) => !input.isConnected)
    ) {
      throw new Error(
        'El modal de cierre cambió durante la consulta; no se cargaron datos.',
      );
    }

    const values = {
      r08: data.r08,
      t11: data.t11,
      tucan: data.tucan,
      tiempos: data.tiempos,
    };

    for (const [name, value] of Object.entries(values)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`El valor ${name.toUpperCase()} no es válido.`);
      }
    }

    for (const [name, input] of Object.entries(expectedInputs)) {
      Core.setNativeValue(input, Core.amountToInputValue(values[name]));
    }
  }

  async function handleLoadData() {
    const button = document.getElementById(BUTTON_ID);
    if (!button || button.disabled) return;
    const expectedSection = getVerificationSection();
    const expectedInputs = expectedSection && findAmountInputs(expectedSection);
    if (!expectedSection || !expectedInputs) return;
    const requestId = activeLoadRequestId + 1;
    activeLoadRequestId = requestId;

    button.disabled = true;
    button.textContent = 'Cargando…';
    setStatus('Consultando BCR, Contica y Tiempos…');

    try {
      const response = await chrome.runtime.sendMessage({ type: 'LR_COLLECT_ALL' });
      if (!response?.ok) {
        throw new Error(response?.error || 'No se pudieron cargar los datos.');
      }

      if (
        requestId !== activeLoadRequestId ||
        !button.isConnected ||
        button !== document.getElementById(BUTTON_ID)
      ) {
        throw new Error(
          'El modal de cierre cambió durante la consulta; no se cargaron datos.',
        );
      }

      fillClosingInputs(response.data, expectedSection, expectedInputs);
      setStatus(`Datos cargados para ${response.data.reportDate}.`, 'success');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : String(error),
        'error',
      );
    } finally {
      button.disabled = false;
      button.textContent = 'Cargar datos';
    }
  }

  function injectButton() {
    if (location.hash !== '#fondogeneral' || document.getElementById(BUTTON_ID)) {
      return;
    }

    const section = getVerificationSection();
    if (!section || !findAmountInputs(section)) return;

    const heading = section.querySelector('h4');
    const summaryRow = heading?.nextElementSibling?.firstElementChild;
    const wrapper = document.createElement('div');
    wrapper.className = 'leer-registro-acciones';

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Cargar datos';
    button.addEventListener('click', handleLoadData);

    const status = document.createElement('span');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    wrapper.append(button, status);
    if (summaryRow) {
      summaryRow.appendChild(wrapper);
    } else {
      heading?.insertAdjacentElement('afterend', wrapper);
    }
  }

  const observer = new MutationObserver(injectButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.addEventListener('hashchange', injectButton);
  injectButton();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'LR_PING') {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type !== 'LR_COLLECT_TIEMPOS') return false;

    collectTiemposTotal(message.requestedAt)
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
