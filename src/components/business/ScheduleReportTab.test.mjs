import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./ScheduleReportTab.tsx", import.meta.url),
  "utf8",
);

test("schedule edit mode batches changes until edition is finalized", () => {
  assert.match(source, /const handleEditToggle = async \(\) =>/);
  assert.match(source, /<ConfirmModal/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /Promise\.allSettled\(/);
  assert.match(source, /year: currentPeriod!\.year/);
  assert.match(source, /schedule\.year/);
  assert.doesNotMatch(source, /onBlur=\{\(\) =>\s*handleCellBlur/);
});
