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

assert.doesNotMatch(
  modal,
  /tiemposStatus === "RESOLVED"[\s\S]{0,120}return "warning"/,
  "DailyClosingModal must not render RESOLVED as warning.",
);
assert.match(
  modal,
  /tiemposStatus === "RESOLVED"[\s\S]{0,120}return "success"/,
  "DailyClosingModal must render RESOLVED as success.",
);
assert.doesNotMatch(
  history,
  /tiemposStatus === "RESOLVED"[\s\S]{0,120}return "warning"/,
  "DailyClosingHistorySection must not render RESOLVED as warning.",
);
assert.match(
  history,
  /tiemposStatus === "RESOLVED"[\s\S]{0,120}return "success"/,
  "DailyClosingHistorySection must render RESOLVED as success.",
);
