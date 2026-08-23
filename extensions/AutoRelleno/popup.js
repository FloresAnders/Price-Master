(function initClientePopup(global) {
  const CLIENT_STORAGE_KEY = "genteCrystalClienteHistory";

  function normalizeClientName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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

  function storageGet(key) {
    return new Promise((resolve) => {
      global.chrome.storage.local.get(key, (result) => resolve(result || {}));
    });
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      global.chrome.storage.local.set(value, () => resolve());
    });
  }

  async function readClients() {
    const result = await storageGet(CLIENT_STORAGE_KEY);
    return sortClients(result[CLIENT_STORAGE_KEY]);
  }

  async function writeClients(clients) {
    await storageSet({ [CLIENT_STORAGE_KEY]: sortClients(clients) });
  }

  async function render() {
    const list = document.getElementById("client-list");
    const empty = document.getElementById("empty");
    const count = document.getElementById("count");
    const clients = await readClients();

    list.replaceChildren();
    count.textContent = String(clients.length);
    empty.dataset.visible = String(clients.length === 0);

    clients.forEach((client) => {
      const row = document.createElement("li");
      row.className = "client-row";

      const name = document.createElement("span");
      name.className = "client-name";
      name.textContent = client.name;
      name.title = client.name;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "delete-client";
      button.textContent = "x";
      button.title = `Borrar ${client.name}`;
      button.setAttribute("aria-label", `Borrar ${client.name}`);
      button.addEventListener("click", async () => {
        await writeClients(clients.filter((item) => item.name !== client.name));
        await render();
      });

      row.append(name, button);
      list.appendChild(row);
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})(globalThis);
