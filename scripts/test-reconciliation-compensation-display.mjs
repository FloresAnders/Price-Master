import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const modal = readFileSync(
  "src/app/fondogeneral/components/modals/DailyClosingModal.tsx",
  "utf8",
);
const history = readFileSync(
  "src/components/daily-closings/DailyClosingHistorySection.tsx",
  "utf8",
);

assert.match(
  modal,
  /compensationResultLabel/,
  "DailyClosingModal must label final-shift remaining compensation as real difference.",
);
assert.match(
  modal,
  /tiemposRealShiftDifference/,
  "DailyClosingModal compensation section must display real final-shift difference.",
);
assert.match(
  history,
  /compensationResultLabel/,
  "DailyClosingHistorySection must label final-shift remaining compensation as real difference.",
);
assert.match(
  history,
  /tiemposRealShiftDifference/,
  "DailyClosingHistorySection compensation section must display real final-shift difference.",
);
