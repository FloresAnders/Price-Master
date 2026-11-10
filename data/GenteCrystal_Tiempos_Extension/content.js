(() => {
  // Puente entre el script aislado de la extensión y el contexto de la página.
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("page-hook.js");
  s.onload = () => s.remove();
  (document.documentElement || document.head).appendChild(s);
})();
