(function initAutofillProtectionContent(global) {
  const STORAGE_KEY = "autofillProtectionSettings";
  const core = global.AutofillProtectionCore;
  const gateApi = global.AutofillProtectionGate;
  const extensionApi = global.browser || global.chrome;
  const promiseStorage = global.browser?.storage?.local || null;
  const callbackStorage = global.chrome?.storage?.local || null;

  let activeGate = null;
  let overlayHost = null;
  let observer = null;
  let settingsCache = null;

  function storageGet(key) {
    if (promiseStorage) {
      return promiseStorage.get(key).then((value) => value || {});
    }
    return new Promise((resolve) => {
      callbackStorage.get(key, (value) => resolve(value || {}));
    });
  }

  async function loadSettings() {
    const result = await storageGet(STORAGE_KEY);
    settingsCache = core.normalizeSettings(result[STORAGE_KEY]);
    return settingsCache;
  }

  function removeOverlay() {
    if (overlayHost) overlayHost.remove();
    overlayHost = null;
  }

  function disconnectObserver() {
    if (observer) observer.disconnect();
    observer = null;
  }

  async function createOverlay(gate) {
    removeOverlay();
    const mountTarget = await gateApi.waitForDocumentRoot(document);

    overlayHost = document.createElement("div");
    overlayHost.id = "proteccion-autorrelleno-overlay";
    overlayHost.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:grid",
      "place-items:center",
      "background:rgba(15,23,42,.72)",
      "font-family:Arial,Helvetica,sans-serif",
    ].join(";");

    const shadow = overlayHost.attachShadow({ mode: "closed" });
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .panel {
          width: min(420px, calc(100vw - 32px));
          border: 1px solid #334155;
          border-radius: 8px;
          background: #111827;
          color: #e5e7eb;
          box-shadow: 0 24px 70px rgb(0 0 0 / 55%);
          padding: 18px;
        }
        h1 { margin: 0 0 7px; font-size: 18px; letter-spacing: 0; }
        p { margin: 0 0 14px; color: #cbd5e1; font-size: 13px; line-height: 1.4; }
        label { display: grid; gap: 6px; color: #94a3b8; font-size: 12px; }
        input {
          width: 100%;
          height: 38px;
          border: 1px solid #475569;
          border-radius: 7px;
          background: #020617;
          color: #f8fafc;
          padding: 0 10px;
          outline: none;
        }
        input:focus { border-color: #22c55e; }
        .actions { display: flex; justify-content: flex-end; margin-top: 12px; }
        button {
          border: 1px solid #166534;
          border-radius: 7px;
          background: #14532d;
          color: #f8fafc;
          padding: 8px 13px;
          cursor: pointer;
        }
        button:hover { background: #166534; }
        .error { min-height: 15px; margin: 8px 0 0; color: #fca5a5; font-size: 12px; }
      </style>
      <form class="panel">
        <h1>Autorrelleno protegido</h1>
        <p>Esta pagina tiene campos de usuario y contrasena. Ingresa la contrasena de la extension para permitir el autorrelleno.</p>
        <label>
          Contrasena de la extension
          <input id="password" type="password" autocomplete="off" autofocus>
        </label>
        <div id="error" class="error" aria-live="polite"></div>
        <div class="actions">
          <button type="submit">Desbloquear</button>
        </div>
      </form>
    `;

    const form = wrapper.querySelector("form");
    const input = wrapper.querySelector("#password");
    const error = wrapper.querySelector("#error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      const ok = await gate.attemptUnlock(input.value);
      if (!ok) {
        input.value = "";
        error.textContent = "Contrasena incorrecta.";
        input.focus();
        return;
      }
      removeOverlay();
      disconnectObserver();
    });

    shadow.appendChild(wrapper);
    mountTarget.appendChild(overlayHost);
    setTimeout(() => input.focus(), 0);
  }

  async function protectIfNeeded() {
    if (activeGate?.isLocked()) return;

    const settings = settingsCache || (await loadSettings());
    const fields = core.detectCredentialFields(document);
    if (
      !core.shouldProtectPage({
        settings,
        pageUrl: location.href,
        fields,
      })
    ) {
      return;
    }

    activeGate = gateApi.createCredentialGate({
      document,
      pageUrl: location.href,
      settings,
      verifyPassword: core.verifyPassword,
    });
    const started = await activeGate.start();
    if (started) await createOverlay(activeGate);
  }

  function scheduleProtectionCheck() {
    setTimeout(() => {
      protectIfNeeded().catch(() => {});
    }, 0);
  }

  async function observeCredentials() {
    if (observer) return;
    const root = await gateApi.waitForDocumentRoot(document);
    observer = new MutationObserver(scheduleProtectionCheck);
    observer.observe(root,
    {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["type", "autocomplete", "name", "id"],
    });
  }

  extensionApi.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    settingsCache = core.normalizeSettings(changes[STORAGE_KEY].newValue);
    if (settingsCache.enabled === false && activeGate?.isLocked()) {
      activeGate.unlock();
      removeOverlay();
      disconnectObserver();
    } else {
      observeCredentials().catch(() => {});
      scheduleProtectionCheck();
    }
  });

  loadSettings()
    .then((settings) => {
      if (!settings.enabled) return;
      scheduleProtectionCheck();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleProtectionCheck, {
          once: true,
        });
      }
      observeCredentials();
    })
    .catch(() => {});
})(globalThis);
