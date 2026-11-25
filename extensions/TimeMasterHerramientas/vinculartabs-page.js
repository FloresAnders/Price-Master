(function initializeVincularTabsPage() {
  "use strict";

  const CONTEXT_SOURCE = "tmh-vincular-tabs-page";
  const COMMAND_SOURCE = "tmh-vincular-tabs-extension";

  function readUid() {
    if (typeof uuidUser !== "undefined" && uuidUser) return String(uuidUser);
    return window.uuidUser ? String(window.uuidUser) : "";
  }

  function sendContext() {
    window.postMessage(
      {
        source: CONTEXT_SOURCE,
        uid: readUid(),
        currentTab: Number(window.vApp?.current_tab),
      },
      "*",
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== COMMAND_SOURCE) return;
    if (event.data.type !== "reload") return;
    if (Number(event.data.tab) !== Number(window.vApp?.current_tab)) return;
    if (typeof window.vApp?.reloadData === "function") window.vApp.reloadData();
  });

  sendContext();
  window.setInterval(sendContext, 500);
})();
