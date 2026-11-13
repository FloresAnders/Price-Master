/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeConticaContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const cambioTab = isCommonJs
    ? require("./cambiotab-core.js")
    : root.TimeMasterHerramientasCambioTab;
  const cerrarImpresionContica = isCommonJs
    ? null
    : root.TimeMasterHerramientasCerrarImpresionContica;
  const dividirEfectivo = isCommonJs
    ? null
    : root.TimeMasterHerramientasDividirEfectivo;
  const moverPago = isCommonJs
    ? null
    : root.TimeMasterHerramientasMoverPago;
  const modalPago = isCommonJs
    ? null
    : root.TimeMasterHerramientasModalPago;
  const PRINT_SHORTCUT_EVENT =
    "tmh-contica-navedi-print-shortcut-setting";
  const MODAL_PAGO_FORMAT_EVENT =
    "tmh-contica-modal-pago-format-setting";
  const api = factory(settings);

  root.TimeMasterHerramientasContica = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api
      .createConticaController({
        storage: root.chrome.storage,
        tabController: cambioTab.createTabController(root.document),
        printInvoiceCloser:
          cerrarImpresionContica.createPrintInvoiceCloser(root.document),
        cashDivisionController:
          dividirEfectivo.createCashDivisionController(root.document),
        paymentShortcutController:
          moverPago.createPaymentShortcutController(root.document),
        paymentModalController: modalPago.createPaymentModalController(
          root.document,
          {
            onSizeChange({ widthPx, heightPx }) {
              root.chrome.storage.local.set({
                tmhModalPagoWidthPx: widthPx,
                tmhModalPagoHeightPx: heightPx,
              });
            },
          },
        ),
        paymentModalFormatBridge: {
          setEnabled(enabled) {
            root.document.dispatchEvent(
              new root.CustomEvent(MODAL_PAGO_FORMAT_EVENT, {
                detail: { enabled: enabled === true },
              }),
            );
          },
        },
        printShortcutBridge: {
          setEnabled(enabled) {
            root.document.dispatchEvent(
              new root.CustomEvent(PRINT_SHORTCUT_EVENT, {
                detail: { enabled: enabled === true },
              }),
            );
          },
        },
        settings,
      })
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildConticaContent(
  settingsApi,
) {
  "use strict";

  const CAMBIO_TAB_SETTING_KEY = "tmhCambioTabEnabled";
  const CERRAR_IMPRESION_SETTING_KEY = "tmhCerrarImpresionConticaEnabled";
  const CERRAR_IMPRESION_DELAY_SETTING_KEY =
    "tmhCerrarImpresionConticaDelaySeconds";
  const CERRAR_IMPRESION_MESSAGE_SETTING_KEY =
    "tmhCerrarImpresionConticaMessage";
  const DIVIDIR_EFECTIVO_SETTING_KEY = "tmhDividirEfectivoEnabled";
  const MOVER_PAGO_SETTING_KEY = "tmhMoverPagoEnabled";
  const MODAL_PAGO_SETTING_KEY = "tmhModalPagoEnabled";
  const MODAL_PAGO_TEXTO_SETTING_KEY = "tmhModalPagoTextoGrandeEnabled";
  const MODAL_PAGO_INPUTS_SETTING_KEY = "tmhModalPagoInputsGrandesEnabled";
  const MODAL_PAGO_RESIZE_SETTING_KEY = "tmhModalPagoRedimensionarEnabled";
  const MODAL_PAGO_FORMAT_SETTING_KEY = "tmhModalPagoFormatoColonesEnabled";
  const MODAL_PAGO_FONT_SIZE_SETTING_KEY = "tmhModalPagoFontSizePx";
  const MODAL_PAGO_INPUT_HEIGHT_SETTING_KEY = "tmhModalPagoInputHeightLevel";
  const MODAL_PAGO_WIDTH_SETTING_KEY = "tmhModalPagoWidthPx";
  const MODAL_PAGO_HEIGHT_SETTING_KEY = "tmhModalPagoHeightPx";
  const PRINT_SHORTCUT_SETTING_KEY =
    "tmhImpresionAutomaticaConticaEnabled";

  function createConticaController({
    storage,
    tabController,
    printInvoiceCloser,
    cashDivisionController,
    paymentShortcutController,
    paymentModalController,
    paymentModalFormatBridge,
    printShortcutBridge,
    settings,
  }) {
    const settingsCore = settings || settingsApi;
    const modalCloser = printInvoiceCloser || {
      start() {},
      stop() {},
      setDelaySeconds() {},
      setMessage() {},
    };
    const cashDivider = cashDivisionController || { start() {}, stop() {} };
    const paymentShortcut = paymentShortcutController || {
      start() {},
      stop() {},
    };
    const paymentModal = paymentModalController || {
      start() {},
      stop() {},
      setTextScaleEnabled() {},
      setInputScaleEnabled() {},
      setTextFontSizePx() {},
      setInputHeightLevel() {},
      setResizeEnabled() {},
      setCurrencyFormatEnabled() {},
      setSavedSize() {},
    };
    const printShortcut = printShortcutBridge || { setEnabled() {} };
    const paymentModalFormat = paymentModalFormatBridge || { setEnabled() {} };
    const changedDuringInitialLoad = new Set();
    let started = false;
    let settingsLoaded = false;
    let lifecycleEpoch = 0;
    let paymentModalSize = { widthPx: 0, heightPx: 0 };
    let paymentModalEnabled = false;
    let paymentModalFormatEnabled = false;

    function syncPaymentModalFormat() {
      paymentModalFormat.setEnabled(
        paymentModalEnabled && paymentModalFormatEnabled,
      );
    }

    function applyCambioTabEnabled(enabled) {
      if (enabled) tabController.start();
      else tabController.stop();
    }

    function applyCerrarImpresionEnabled(enabled) {
      if (enabled) modalCloser.start();
      else modalCloser.stop();
    }

    function applyCerrarImpresionDelay(seconds) {
      modalCloser.setDelaySeconds?.(seconds);
    }

    function applyCerrarImpresionMessage(message) {
      modalCloser.setMessage?.(message);
    }

    function applyDividirEfectivoEnabled(enabled) {
      if (enabled) cashDivider.start();
      else cashDivider.stop();
    }

    function applyMoverPagoEnabled(enabled) {
      if (enabled) paymentShortcut.start();
      else paymentShortcut.stop();
    }

    function applyModalPagoEnabled(enabled) {
      paymentModalEnabled = enabled === true;
      if (enabled) paymentModal.start();
      else paymentModal.stop();
      syncPaymentModalFormat();
    }

    function applyModalPagoTextEnabled(enabled) {
      paymentModal.setTextScaleEnabled(enabled === true);
    }

    function applyModalPagoInputsEnabled(enabled) {
      paymentModal.setInputScaleEnabled(enabled === true);
    }

    function applyModalPagoResizeEnabled(enabled) {
      paymentModal.setResizeEnabled(enabled === true);
    }

    function applyModalPagoFormatEnabled(enabled) {
      paymentModalFormatEnabled = enabled === true;
      syncPaymentModalFormat();
    }

    function applyModalPagoFontSize(sizePx) {
      paymentModal.setTextFontSizePx(sizePx);
    }

    function applyModalPagoInputHeight(level) {
      paymentModal.setInputHeightLevel(level);
    }

    function applyModalPagoSize(next) {
      paymentModalSize = { ...paymentModalSize, ...next };
      paymentModal.setSavedSize(paymentModalSize);
    }

    function applyPrintShortcutEnabled(enabled) {
      printShortcut.setEnabled(enabled === true);
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const cambioTabEnabled = settingsCore.readChangedSetting(
        changes,
        CAMBIO_TAB_SETTING_KEY,
      );
      if (cambioTabEnabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(CAMBIO_TAB_SETTING_KEY);
        applyCambioTabEnabled(cambioTabEnabled);
      }

      const cerrarImpresionDelay = settingsCore.readChangedPositiveInteger(
        changes,
        CERRAR_IMPRESION_DELAY_SETTING_KEY,
      );
      if (cerrarImpresionDelay !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(CERRAR_IMPRESION_DELAY_SETTING_KEY);
        }
        applyCerrarImpresionDelay(cerrarImpresionDelay);
      }

      const cerrarImpresionMessage = settingsCore.readChangedNonEmptyString(
        changes,
        CERRAR_IMPRESION_MESSAGE_SETTING_KEY,
      );
      if (cerrarImpresionMessage !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(CERRAR_IMPRESION_MESSAGE_SETTING_KEY);
        }
        applyCerrarImpresionMessage(cerrarImpresionMessage);
      }

      const cerrarImpresionEnabled = settingsCore.readChangedSetting(
        changes,
        CERRAR_IMPRESION_SETTING_KEY,
      );
      if (cerrarImpresionEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(CERRAR_IMPRESION_SETTING_KEY);
        }
        applyCerrarImpresionEnabled(cerrarImpresionEnabled);
      }

      const dividirEfectivoEnabled = settingsCore.readChangedSetting(
        changes,
        DIVIDIR_EFECTIVO_SETTING_KEY,
      );
      if (dividirEfectivoEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(DIVIDIR_EFECTIVO_SETTING_KEY);
        }
        applyDividirEfectivoEnabled(dividirEfectivoEnabled);
      }

      const moverPagoEnabled = settingsCore.readChangedSetting(
        changes,
        MOVER_PAGO_SETTING_KEY,
      );
      if (moverPagoEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(MOVER_PAGO_SETTING_KEY);
        }
        applyMoverPagoEnabled(moverPagoEnabled);
      }

      const modalPagoSettings = [
        [MODAL_PAGO_SETTING_KEY, applyModalPagoEnabled],
        [MODAL_PAGO_TEXTO_SETTING_KEY, applyModalPagoTextEnabled],
        [MODAL_PAGO_INPUTS_SETTING_KEY, applyModalPagoInputsEnabled],
        [MODAL_PAGO_RESIZE_SETTING_KEY, applyModalPagoResizeEnabled],
        [MODAL_PAGO_FORMAT_SETTING_KEY, applyModalPagoFormatEnabled],
      ];
      for (const [key, apply] of modalPagoSettings) {
        const enabled = settingsCore.readChangedSetting(changes, key);
        if (enabled === undefined) continue;
        if (!settingsLoaded) changedDuringInitialLoad.add(key);
        apply(enabled);
      }

      const modalWidth = settingsCore.readChangedNonNegativeInteger(
        changes,
        MODAL_PAGO_WIDTH_SETTING_KEY,
      );
      if (modalWidth !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(MODAL_PAGO_WIDTH_SETTING_KEY);
        applyModalPagoSize({ widthPx: modalWidth });
      }
      const modalHeight = settingsCore.readChangedNonNegativeInteger(
        changes,
        MODAL_PAGO_HEIGHT_SETTING_KEY,
      );
      if (modalHeight !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(MODAL_PAGO_HEIGHT_SETTING_KEY);
        applyModalPagoSize({ heightPx: modalHeight });
      }
      const modalFontSize = settingsCore.readChangedModalPaymentFontSizePx(
        changes,
        MODAL_PAGO_FONT_SIZE_SETTING_KEY,
      );
      if (modalFontSize !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(MODAL_PAGO_FONT_SIZE_SETTING_KEY);
        applyModalPagoFontSize(modalFontSize);
      }
      const modalInputHeight =
        settingsCore.readChangedModalPaymentInputHeightLevel(
          changes,
          MODAL_PAGO_INPUT_HEIGHT_SETTING_KEY,
        );
      if (modalInputHeight !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(MODAL_PAGO_INPUT_HEIGHT_SETTING_KEY);
        }
        applyModalPagoInputHeight(modalInputHeight);
      }

      const printShortcutEnabled = settingsCore.readChangedSetting(
        changes,
        PRINT_SHORTCUT_SETTING_KEY,
      );
      if (printShortcutEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(PRINT_SHORTCUT_SETTING_KEY);
        }
        applyPrintShortcutEnabled(printShortcutEnabled);
      }
    }

    function start() {
      if (started) return;
      started = true;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      const currentEpoch = ++lifecycleEpoch;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started || currentEpoch !== lifecycleEpoch) return;
        const normalized = settingsCore.normalizeSettings(stored);
        if (!changedDuringInitialLoad.has(CAMBIO_TAB_SETTING_KEY)) {
          applyCambioTabEnabled(normalized[CAMBIO_TAB_SETTING_KEY]);
        }
        if (
          !changedDuringInitialLoad.has(CERRAR_IMPRESION_DELAY_SETTING_KEY)
        ) {
          applyCerrarImpresionDelay(
            normalized[CERRAR_IMPRESION_DELAY_SETTING_KEY],
          );
        }
        if (
          !changedDuringInitialLoad.has(CERRAR_IMPRESION_MESSAGE_SETTING_KEY)
        ) {
          applyCerrarImpresionMessage(
            normalized[CERRAR_IMPRESION_MESSAGE_SETTING_KEY],
          );
        }
        if (!changedDuringInitialLoad.has(CERRAR_IMPRESION_SETTING_KEY)) {
          applyCerrarImpresionEnabled(normalized[CERRAR_IMPRESION_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(DIVIDIR_EFECTIVO_SETTING_KEY)) {
          applyDividirEfectivoEnabled(normalized[DIVIDIR_EFECTIVO_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(MOVER_PAGO_SETTING_KEY)) {
          applyMoverPagoEnabled(normalized[MOVER_PAGO_SETTING_KEY]);
        }
        const modalPagoSettings = [
          [MODAL_PAGO_TEXTO_SETTING_KEY, applyModalPagoTextEnabled],
          [MODAL_PAGO_INPUTS_SETTING_KEY, applyModalPagoInputsEnabled],
          [MODAL_PAGO_RESIZE_SETTING_KEY, applyModalPagoResizeEnabled],
          [MODAL_PAGO_FORMAT_SETTING_KEY, applyModalPagoFormatEnabled],
        ];
        for (const [key, apply] of modalPagoSettings) {
          if (!changedDuringInitialLoad.has(key)) apply(normalized[key]);
        }
        if (!changedDuringInitialLoad.has(MODAL_PAGO_FONT_SIZE_SETTING_KEY)) {
          applyModalPagoFontSize(normalized[MODAL_PAGO_FONT_SIZE_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(MODAL_PAGO_INPUT_HEIGHT_SETTING_KEY)) {
          applyModalPagoInputHeight(normalized[MODAL_PAGO_INPUT_HEIGHT_SETTING_KEY]);
        }
        const nextSize = { ...paymentModalSize };
        if (!changedDuringInitialLoad.has(MODAL_PAGO_WIDTH_SETTING_KEY)) {
          nextSize.widthPx = normalized[MODAL_PAGO_WIDTH_SETTING_KEY];
        }
        if (!changedDuringInitialLoad.has(MODAL_PAGO_HEIGHT_SETTING_KEY)) {
          nextSize.heightPx = normalized[MODAL_PAGO_HEIGHT_SETTING_KEY];
        }
        applyModalPagoSize(nextSize);
        if (!changedDuringInitialLoad.has(MODAL_PAGO_SETTING_KEY)) {
          applyModalPagoEnabled(normalized[MODAL_PAGO_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(PRINT_SHORTCUT_SETTING_KEY)) {
          applyPrintShortcutEnabled(normalized[PRINT_SHORTCUT_SETTING_KEY]);
        }
        settingsLoaded = true;
        changedDuringInitialLoad.clear();
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      lifecycleEpoch += 1;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      storage.onChanged.removeListener(handleStorageChange);
      tabController.stop();
      modalCloser.stop();
      cashDivider.stop();
      paymentShortcut.stop();
      paymentModal.stop();
      paymentModalFormat.setEnabled(false);
      printShortcut.setEnabled(false);
    }

    return { start, destroy };
  }

  return { createConticaController };
});
