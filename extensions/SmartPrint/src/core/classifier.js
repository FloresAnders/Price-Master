(function initializeClassifier(root, factory) {
  const dependencies = typeof module === "object" && module.exports
    ? {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        contica: require("../content/providers/contica.js"),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        crystal: require("../content/providers/gentecrystal.js"),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        tucan: require("../content/providers/tucan.js"),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        generic: require("../content/providers/generic.js"),
      }
    : {
        contica: root.SmartPrintContica,
        crystal: root.SmartPrintGenteCrystal,
        tucan: root.SmartPrintTucan,
        generic: root.SmartPrintGeneric,
      };
  const api = factory(dependencies);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintClassifier = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildClassifier(providers) {
  "use strict";
  function classifyAndExtract(documentRef) {
    for (const provider of [providers.contica, providers.crystal, providers.tucan]) {
      if (provider?.matches(documentRef)) {
        const documentValue = provider.extract(documentRef);
        if (documentValue) return { recognized: true, canPrintOriginal: true, document: documentValue };
      }
    }
    return { recognized: false, canPrintOriginal: true, document: providers.generic.extract(documentRef) };
  }
  return { classifyAndExtract };
});
