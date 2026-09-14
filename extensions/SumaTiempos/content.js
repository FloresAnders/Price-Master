(function initializeSumaTiempos(global) {
  "use strict";

  global.SumaTiemposCore
    .createSumaTiemposController(global.document, global)
    .start();
})(globalThis);
