(function initBcrCollector() {
  'use strict';

  if (globalThis.__leerRegistroBcrLoaded) return;
  globalThis.__leerRegistroBcrLoaded = true;

  const Core = globalThis.LeerRegistroCore;
  const JOB_STORAGE_KEY = 'leer-registro-bcr-job';

  function readPendingJob() {
    try {
      const raw = sessionStorage.getItem(JOB_STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function writePendingJob(job) {
    try {
      sessionStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(job));
    } catch (_error) {
      // El reintento del background todavía protege las recargas del documento.
    }
  }

  function clearPendingJob() {
    try {
      sessionStorage.removeItem(JOB_STORAGE_KEY);
    } catch (_error) {
      // El marcador expira al iniciar una consulta con otro requestedAt.
    }
  }

  function getDocuments(root = document, collected = []) {
    collected.push(root);
    for (const frame of root.querySelectorAll('iframe, frame')) {
      try {
        if (frame.contentDocument) getDocuments(frame.contentDocument, collected);
      } catch (_error) {
        // Los marcos de otro origen no son parte del reporte BCR esperado.
      }
    }
    return collected;
  }

  function findInDocuments(selector) {
    for (const currentDocument of getDocuments()) {
      const element = currentDocument.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function findTotalGeneral() {
    for (const currentDocument of getDocuments()) {
      for (const row of currentDocument.querySelectorAll('tr')) {
        const cells = Array.from(row.children).filter((child) =>
          child.matches('td, th'),
        );
        if (!cells.length) continue;
        const labelIndex = cells.findIndex((cell) =>
          Core.normalizeText(cell.textContent).includes('total general'),
        );
        if (labelIndex < 0) continue;

        for (let index = cells.length - 1; index > labelIndex; index -= 1) {
          const amount = Core.parseMoney(cells[index].textContent);
          if (amount !== null) {
            return {
              amount,
              row,
              signature: Core.normalizeText(row.textContent),
            };
          }
        }
      }
    }
    return null;
  }

  async function openCashierPaymentsReport() {
    if (findInDocuments('#ContenidoCentral_btnGenerarReporte')) return;

    const reportItem = await Core.waitFor(
      () => document.querySelector('#ope401'),
      {
        message: 'No se encontró la sección Reportes en BCR Corresponsales.',
      },
    );
    const reportLink =
      reportItem.querySelector('a.mm-subopen') ||
      reportItem.querySelector('a') ||
      reportItem;
    reportLink.click();

    const cashierPayments = await Core.waitFor(
      () => document.querySelector('#ope402 a'),
      {
        message: 'No se encontró “Pagos de un Cajero” en el menú de BCR.',
      },
    );
    cashierPayments.click();

    await Core.waitFor(
      () => findInDocuments('#ContenidoCentral_btnGenerarReporte'),
      {
        timeoutMs: 45000,
        message: 'BCR no cargó el formulario “Pagos de un Cajero”.',
      },
    );
  }

  async function collectBcrTotal(requestedAt) {
    const reportDate = Core.getReportDate(new Date(requestedAt));
    const formattedDate = Core.formatDateDDMMYYYY(reportDate);
    const pendingJob = readPendingJob();

    if (
      pendingJob?.requestedAt === requestedAt &&
      pendingJob?.stage === 'awaiting-report'
    ) {
      const documentReloaded =
        Number(pendingJob.pageTimeOrigin) !== performance.timeOrigin;
      const generatedResult = await Core.waitFor(() => {
        const currentResult = findTotalGeneral();
        if (!currentResult) return false;
        if (documentReloaded) return currentResult;
        return currentResult.signature !== pendingJob.previousSignature
          ? currentResult
          : false;
      }, {
        timeoutMs: 60000,
        message: 'BCR terminó de cargar, pero no mostró el Total General.',
      });
      clearPendingJob();
      return {
        total: generatedResult.amount,
        reportDate: Core.formatDateISO(reportDate),
      };
    }

    if (pendingJob?.requestedAt !== requestedAt) clearPendingJob();

    await openCashierPaymentsReport();

    const startInput = findInDocuments('#ContenidoCentral_txtFechaInicio');
    const endInput = findInDocuments('#ContenidoCentral_txtFechaFin');
    const formatSelect = findInDocuments('#ContenidoCentral_ddlFormatos');
    const generateButton = findInDocuments('#ContenidoCentral_btnGenerarReporte');

    if (!startInput || !endInput || !generateButton) {
      throw new Error('El formulario de BCR no contiene los controles esperados.');
    }

    Core.setNativeValue(startInput, formattedDate);
    Core.setNativeValue(endInput, formattedDate);

    if (formatSelect) {
      const htmlOption = Array.from(formatSelect.options).find(
        (option) => Core.normalizeText(option.textContent) === 'html',
      );
      if (htmlOption) Core.setNativeValue(formatSelect, htmlOption.value);
    }

    const previousResult = findTotalGeneral();
    writePendingJob({
      requestedAt,
      reportDate: Core.formatDateISO(reportDate),
      stage: 'awaiting-report',
      pageTimeOrigin: performance.timeOrigin,
      previousSignature: previousResult?.signature || '',
    });
    generateButton.click();

    const generatedResult = await Core.waitFor(() => {
      const currentResult = findTotalGeneral();
      if (!currentResult) return false;
      if (!previousResult) return currentResult;
      if (!previousResult.row.isConnected) return currentResult;
      if (currentResult.row !== previousResult.row) return currentResult;
      if (currentResult.amount !== previousResult.amount) return currentResult;
      return false;
    }, {
      timeoutMs: 60000,
      message: 'BCR no confirmó un Total General actualizado del reporte.',
    });

    clearPendingJob();

    return {
      total: generatedResult.amount,
      reportDate: Core.formatDateISO(reportDate),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'LR_PING') {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type !== 'LR_COLLECT_BCR') return false;

    collectBcrTotal(message.requestedAt)
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
