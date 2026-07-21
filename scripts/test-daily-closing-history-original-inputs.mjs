import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const history = readFileSync(
  "src/components/daily-closings/DailyClosingHistorySection.tsx",
  "utf8",
);

assert.match(
  history,
  /Valores digitados/,
  "Daily closing history must label the originally typed values.",
);
assert.match(
  history,
  /externalSnapshots\s*\?\.\s*tucanCumulative/,
  "Daily closing history must display the typed Tucan cumulative value.",
);
assert.match(
  history,
  /externalSnapshots\s*\?\.\s*tiemposCumulative/,
  "Daily closing history must display the typed Tiempos cumulative value.",
);
assert.match(
  history,
  /reconciliation\.externalSnapshots\s*\?\./,
  "Daily closing history must not crash when legacy records lack externalSnapshots.",
);
assert.doesNotMatch(
  history,
  /\["Tucan", "R08",\s*record\.reconciliation\.calculated\.tucanForShift/,
  "Daily closing history must not show recalculated Tucan shift value as the typed report.",
);
assert.doesNotMatch(
  history,
  /\["Tiempos", "T11",\s*record\.reconciliation\.calculated\.tiemposForShift/,
  "Daily closing history must not show recalculated Tiempos shift value as the typed report.",
);

console.log("daily closing history original input display tests passed");
