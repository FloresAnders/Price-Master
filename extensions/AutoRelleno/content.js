(function initClienteAutocomplete(global) {
  const CLIENT_STORAGE_KEY = "genteCrystalClienteHistory";
  const MAX_CLIENTS = 200;
  const FORBIDDEN_FIELDS = [
    "Sorteo",
    "Restringidos",
    "Registrar a",
    "Numero",
    "Monto",
    "Nica especial",
    "Total del tiquete",
  ];

  function normalizeLookupText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizeClientName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getLabelText(input) {
    if (!input?.ownerDocument) return "";
    const id = input.id ? String(input.id) : "";
    if (id) {
      const label = input.ownerDocument.querySelector(`label[for="${id}"]`);
      if (label?.textContent) return label.textContent;
    }

    const wrapperLabel = input.closest?.("label");
    return wrapperLabel?.textContent || "";
  }

  function collectFieldTokens(input) {
    if (!input) return [];
    return [
      input.getAttribute?.("id"),
      input.getAttribute?.("name"),
      input.getAttribute?.("placeholder"),
      input.getAttribute?.("aria-label"),
      getLabelText(input),
    ].filter(Boolean);
  }

  function isForbiddenField(input) {
    const forbidden = new Set(FORBIDDEN_FIELDS.map(normalizeLookupText));
    return collectFieldTokens(input).some((token) =>
      forbidden.has(normalizeLookupText(token)),
    );
  }

  function hasClienteLabel(input) {
    return normalizeLookupText(getLabelText(input)) === "cliente";
  }

  function isClienteInput(input) {
    return Boolean(
      input instanceof global.HTMLInputElement &&
        input.id === "cliente" &&
        input.name === "cliente" &&
        !isForbiddenField(input) &&
        hasClienteLabel(input),
    );
  }

  function findClienteInput(root) {
    const scope = root || global.document;
    const candidate = scope.querySelector?.('input#cliente[name="cliente"]');
    return isClienteInput(candidate) ? candidate : null;
  }

  function normalizeClientRecord(record) {
    const name = normalizeClientName(record?.name);
    if (!name) return null;
    const createdAt = Number(record?.createdAt) || Date.now();
    const lastUsedAt = Number(record?.lastUsedAt) || createdAt;
    const usageCount = Math.max(1, Number(record?.usageCount) || 1);
    return { name, usageCount, createdAt, lastUsedAt };
  }

  function sortClients(clients) {
    return [...(Array.isArray(clients) ? clients : [])]
      .map(normalizeClientRecord)
      .filter(Boolean)
      .sort((left, right) => {
        if (right.usageCount !== left.usageCount) {
          return right.usageCount - left.usageCount;
        }
        if (right.lastUsedAt !== left.lastUsedAt) {
          return right.lastUsedAt - left.lastUsedAt;
        }
        return left.name.localeCompare(right.name, "es");
      });
  }

  function registerClientUse(clients, rawName, nowValue) {
    const name = normalizeClientName(rawName);
    if (!name) return sortClients(clients);

    const now = Number(nowValue) || Date.now();
    const normalizedName = normalizeLookupText(name);
    let found = false;
    const next = (Array.isArray(clients) ? clients : [])
      .map(normalizeClientRecord)
      .filter(Boolean)
      .map((client) => {
        if (normalizeLookupText(client.name) !== normalizedName) return client;
        found = true;
        return {
          ...client,
          usageCount: client.usageCount + 1,
          lastUsedAt: now,
        };
      });

    if (!found) {
      next.push({
        name,
        usageCount: 1,
        createdAt: now,
        lastUsedAt: now,
      });
    }

    return sortClients(next).slice(0, MAX_CLIENTS);
  }

  function filterClients(clients, query) {
    const normalizedQuery = normalizeLookupText(query);
    if (!normalizedQuery) return sortClients(clients);
    return sortClients(clients).filter((client) =>
      normalizeLookupText(client.name).includes(normalizedQuery),
    );
  }

  function getStorageArea() {
    return global.chrome?.storage?.local || null;
  }

  function storageGet(key) {
    const storage = getStorageArea();
    if (!storage) return Promise.resolve({});
    return new Promise((resolve) => {
      storage.get(key, (result) => resolve(result || {}));
    });
  }

  function storageSet(value) {
    const storage = getStorageArea();
    if (!storage) return Promise.resolve();
    return new Promise((resolve) => {
      storage.set(value, () => resolve());
    });
  }

  async function readClients() {
    const result = await storageGet(CLIENT_STORAGE_KEY);
    return sortClients(result[CLIENT_STORAGE_KEY]);
  }

  async function writeClients(clients) {
    await storageSet({ [CLIENT_STORAGE_KEY]: sortClients(clients) });
  }

  function createAutocompleteController(options) {
    const doc = options.document;
    const input = options.input;
    const read = options.readClients || readClients;
    const write = options.writeClients || writeClients;
    const now = options.now || (() => Date.now());
    const dropdown = doc.createElement("div");
    let clients = [];
    let filtered = [];
    let activeIndex = -1;
    let suppressNextChange = false;
    let lastPersistedValue = "";

    dropdown.className = "gc-cliente-autocomplete";
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "Clientes guardados");
    doc.body.appendChild(dropdown);

    function placeDropdown() {
      const rect = input.getBoundingClientRect();
      dropdown.style.left = `${rect.left + global.scrollX}px`;
      dropdown.style.top = `${rect.bottom + global.scrollY + 2}px`;
      dropdown.style.width = `${rect.width}px`;
    }

    function close() {
      dropdown.dataset.open = "false";
      activeIndex = -1;
    }

    function render() {
      dropdown.replaceChildren();
      filtered.forEach((client, index) => {
        const item = doc.createElement("button");
        item.type = "button";
        item.className = "gc-cliente-autocomplete__item";
        item.textContent = client.name;
        item.setAttribute("role", "option");
        item.dataset.active = String(index === activeIndex);
        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          selectClient(client.name);
        });
        dropdown.appendChild(item);
      });

      placeDropdown();
      dropdown.dataset.open = String(filtered.length > 0);
    }

    function refreshFilter() {
      filtered = filterClients(clients, input.value);
      if (activeIndex >= filtered.length) activeIndex = filtered.length - 1;
      render();
    }

    async function loadAndShow() {
      clients = await read();
      activeIndex = -1;
      refreshFilter();
    }

    async function saveCurrentValue() {
      const name = normalizeClientName(input.value);
      const lookupName = normalizeLookupText(name);
      if (!lookupName || lookupName === lastPersistedValue) return;
      if (!name) return;
      clients = registerClientUse(await read(), name, now());
      await write(clients);
      lastPersistedValue = lookupName;
    }

    async function selectClient(name) {
      input.value = name;
      suppressNextChange = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await saveCurrentValue();
      close();
    }

    input.setAttribute("autocomplete", "off");
    input.addEventListener("focus", loadAndShow);
    input.addEventListener("click", loadAndShow);
    input.addEventListener("input", () => {
      if (!normalizeLookupText(input.value)) lastPersistedValue = "";
      refreshFilter();
    });
    input.addEventListener("change", () => {
      if (suppressNextChange) {
        suppressNextChange = false;
        return;
      }
      saveCurrentValue();
    });
    input.form?.addEventListener("submit", saveCurrentValue, true);
    input.addEventListener("blur", () => {
      global.setTimeout(close, 120);
    });
    input.addEventListener("keydown", (event) => {
      if (dropdown.dataset.open !== "true" || filtered.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % filtered.length;
        render();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex =
          activeIndex <= 0 ? filtered.length - 1 : activeIndex - 1;
        render();
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        selectClient(filtered[activeIndex].name);
      } else if (event.key === "Escape") {
        close();
      }
    });

    global.addEventListener("resize", placeDropdown);
    global.addEventListener("scroll", placeDropdown, true);

    return {
      close,
      dropdown,
      loadAndShow,
      refreshFilter,
      saveCurrentValue,
    };
  }

  function startClienteAutocomplete(doc) {
    const targetDocument = doc || global.document;
    if (!targetDocument?.documentElement || !getStorageArea()) return null;

    let controller = null;
    function attach() {
      const input = findClienteInput(targetDocument);
      if (!input || input.dataset.gcClienteAutocomplete === "true") return;
      input.dataset.gcClienteAutocomplete = "true";
      controller = createAutocompleteController({
        document: targetDocument,
        input,
      });
    }

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(targetDocument.documentElement, {
      childList: true,
      subtree: true,
    });

    return {
      disconnect() {
        observer.disconnect();
        controller?.close();
      },
    };
  }

  const api = {
    CLIENT_STORAGE_KEY,
    FORBIDDEN_FIELDS,
    createAutocompleteController,
    filterClients,
    findClienteInput,
    isClienteInput,
    isForbiddenField,
    normalizeClientName,
    normalizeLookupText,
    registerClientUse,
    sortClients,
    startClienteAutocomplete,
  };

  global.GenteCrystalClienteAutocomplete = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (global.document && getStorageArea()) {
    startClienteAutocomplete(global.document);
  }
})(globalThis);
