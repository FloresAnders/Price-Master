(function initAutofillProtectionPopup(global) {
  const STORAGE_KEY = "autofillProtectionSettings";
  const core = global.AutofillProtectionCore;

  const enabledInput = document.getElementById("enabled");
  const status = document.getElementById("status");
  const passwordPanel = document.getElementById("password-change-panel");
  const passwordSummary = document.getElementById("toggle-password-change");
  const currentPasswordRow = document.getElementById("current-password-row");
  const currentPasswordInput = document.getElementById("current-password");
  const passwordInput = document.getElementById("master-password");
  const passwordConfirmInput = document.getElementById("master-password-confirm");
  const savePasswordButton = document.getElementById("save-password");
  const urlInput = document.getElementById("url-input");
  const addUrlButton = document.getElementById("add-url");
  const urlList = document.getElementById("url-list");
  const disableDialog = document.getElementById("disable-dialog");
  const disableForm = document.getElementById("disable-form");
  const disablePasswordInput = document.getElementById("disable-password");
  const disableError = document.getElementById("disable-error");
  const cancelDisableButton = document.getElementById("cancel-disable");
  const removeDialog = document.getElementById("remove-dialog");
  const removeForm = document.getElementById("remove-form");
  const removePasswordInput = document.getElementById("remove-password");
  const removeError = document.getElementById("remove-error");
  const removeUrlText = document.getElementById("remove-url-text");
  const cancelRemoveButton = document.getElementById("cancel-remove");
  const promiseStorage = global.browser?.storage?.local || null;
  const callbackStorage = global.chrome?.storage?.local || null;

  let settings = core.normalizeSettings();
  let pendingRemoveUrl = "";

  function storageGet(key) {
    if (promiseStorage) {
      return promiseStorage.get(key).then((value) => value || {});
    }
    return new Promise((resolve) => {
      callbackStorage.get(key, (value) => resolve(value || {}));
    });
  }

  function storageSet(value) {
    if (promiseStorage) return promiseStorage.set(value);
    return new Promise((resolve) => {
      callbackStorage.set(value, resolve);
    });
  }

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  async function persist(nextSettings) {
    settings = core.normalizeSettings(nextSettings);
    await storageSet({ [STORAGE_KEY]: settings });
    render();
  }

  function render() {
    const hasPassword = Boolean(settings.passwordRecord);
    enabledInput.checked = settings.enabled && Boolean(settings.passwordRecord);
    passwordSummary.textContent = hasPassword ? "Cambiar contrasena" : "Configurar contrasena";
    currentPasswordRow.hidden = !hasPassword;
    if (!hasPassword) passwordPanel.open = true;
    urlList.replaceChildren();

    for (const url of settings.protectedUrls) {
      const item = document.createElement("li");
      const text = document.createElement("span");
      const removeButton = document.createElement("button");
      text.textContent = url;
      removeButton.type = "button";
      removeButton.textContent = "x";
      removeButton.title = "Eliminar URL";
      removeButton.addEventListener("click", () => askRemovePassword(url));
      item.append(text, removeButton);
      urlList.appendChild(item);
    }

    if (!settings.passwordRecord) {
      setStatus("Configura una contrasena para activar la proteccion.", "error");
    } else {
      setStatus(settings.enabled ? "Proteccion activa." : "Proteccion desactivada.", "ok");
    }
  }

  async function load() {
    const result = await storageGet(STORAGE_KEY);
    settings = core.normalizeSettings(result[STORAGE_KEY]);
    render();
  }

  async function savePassword() {
    const currentPassword = currentPasswordInput.value;
    const password = passwordInput.value;
    const confirmation = passwordConfirmInput.value;
    if (password !== confirmation) {
      setStatus("La verificacion no coincide.", "error");
      return;
    }

    try {
      if (settings.passwordRecord) {
        const currentOk = await core.verifyPassword(
          currentPassword,
          settings.passwordRecord,
        );
        if (!currentOk) {
          currentPasswordInput.value = "";
          currentPasswordInput.focus();
          setStatus("La contrasena actual es incorrecta.", "error");
          return;
        }
      }

      const passwordRecord = await core.createPasswordRecord(password);
      currentPasswordInput.value = "";
      passwordInput.value = "";
      passwordConfirmInput.value = "";
      await persist({ ...settings, passwordRecord, enabled: true });
      passwordPanel.open = false;
      setStatus("Contrasena guardada.", "ok");
    } catch (error) {
      setStatus(String(error?.message || error), "error");
    }
  }

  async function addUrl() {
    const normalized = core.normalizeUrlForMatch(urlInput.value);
    if (!normalized) {
      setStatus("Ingresa una URL valida.", "error");
      return;
    }
    if (settings.protectedUrls.includes(normalized)) {
      setStatus("Esa URL ya esta protegida.", "error");
      return;
    }

    urlInput.value = "";
    await persist({
      ...settings,
      protectedUrls: [...settings.protectedUrls, normalized],
    });
    setStatus("URL agregada.", "ok");
  }

  function askDisablePassword() {
    disablePasswordInput.value = "";
    disableError.textContent = "";
    disableDialog.showModal();
    disablePasswordInput.focus();
  }

  function askRemovePassword(url) {
    if (!settings.passwordRecord) {
      setStatus("Configura una contrasena antes de eliminar URLs.", "error");
      return;
    }
    pendingRemoveUrl = url;
    removePasswordInput.value = "";
    removeError.textContent = "";
    removeUrlText.textContent = `Confirma la contrasena para eliminar ${url}`;
    removeDialog.showModal();
    removePasswordInput.focus();
  }

  enabledInput.addEventListener("change", async () => {
    if (enabledInput.checked) {
      if (!settings.passwordRecord) {
        enabledInput.checked = false;
        setStatus("Guarda una contrasena antes de activar.", "error");
        return;
      }
      await persist({ ...settings, enabled: true });
      setStatus("Proteccion activa.", "ok");
      return;
    }

    enabledInput.checked = true;
    askDisablePassword();
  });

  disableForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ok = await core.canDisableProtection(settings, disablePasswordInput.value);
    if (!ok) {
      disablePasswordInput.value = "";
      disableError.textContent = "Contrasena incorrecta.";
      disablePasswordInput.focus();
      return;
    }

    disableDialog.close();
    await persist({ ...settings, enabled: false });
    setStatus("Proteccion desactivada.", "ok");
  });

  cancelDisableButton.addEventListener("click", () => {
    disableDialog.close();
    enabledInput.checked = settings.enabled;
  });

  removeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ok = await core.verifyPassword(
      removePasswordInput.value,
      settings.passwordRecord,
    );
    if (!ok) {
      removePasswordInput.value = "";
      removeError.textContent = "Contrasena incorrecta.";
      removePasswordInput.focus();
      return;
    }

    const url = pendingRemoveUrl;
    pendingRemoveUrl = "";
    removeDialog.close();
    await persist({
      ...settings,
      protectedUrls: settings.protectedUrls.filter((entry) => entry !== url),
    });
    setStatus("URL eliminada.", "ok");
  });

  cancelRemoveButton.addEventListener("click", () => {
    pendingRemoveUrl = "";
    removeDialog.close();
  });

  savePasswordButton.addEventListener("click", savePassword);
  addUrlButton.addEventListener("click", addUrl);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addUrl();
  });

  load().catch((error) => setStatus(String(error?.message || error), "error"));
})(globalThis);
