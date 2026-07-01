import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";

const outDir = ".tmp/reconciliation-test";
rmSync(outDir, { recursive: true, force: true });

execFileSync(
  "npx",
  [
    "tsc",
    "src/domain/reconciliation.ts",
    "--outDir",
    outDir,
    "--module",
    "commonjs",
    "--target",
    "es2020",
    "--moduleResolution",
    "node",
    "--skipLibCheck",
    "--noEmit",
    "false",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

const require = createRequire(import.meta.url);
const { reconcileClosing } = require(`../${outDir}/reconciliation.js`);

const day = reconcileClosing({
  r08: 15000,
  t11: 15101,
  tucanCumulative: 15000,
  tiemposCumulative: 10000,
  isFinalShift: false,
});

assert.equal(day.calculated.tucanDifference, 0);
assert.equal(day.calculated.tiemposDifference, 5100);
assert.equal(day.calculated.tiemposPendingAfterClosing, 5100);

const night = reconcileClosing({
  r08: 10000,
  t11: 14900,
  tucanCumulative: 25000,
  tiemposCumulative: 30000,
  previous: day,
  cumulativeR08: 25000,
  cumulativeT11: 30000,
  isFinalShift: true,
});

assert.equal(night.calculated.tucanDifference, 0);
assert.equal(night.calculated.tiemposRawDifference, -5100);
assert.equal(night.calculated.tiemposDifference, 0);
assert.equal(night.calculated.tiemposPendingAfterClosing, 0);

const dayNegative = reconcileClosing({
  r08: 15000,
  t11: 10000,
  tucanCumulative: 15000,
  tiemposCumulative: 15100,
  isFinalShift: false,
});

assert.equal(dayNegative.calculated.tiemposDifference, -5100);
assert.equal(dayNegative.calculated.tiemposPendingAfterClosing, -5100);

const nightResolvesNegative = reconcileClosing({
  r08: 10000,
  t11: 20000,
  tucanCumulative: 25000,
  tiemposCumulative: 30000,
  previous: dayNegative,
  cumulativeR08: 25000,
  cumulativeT11: 30000,
  isFinalShift: true,
});

assert.equal(nightResolvesNegative.calculated.tiemposRawDifference, 5100);
assert.equal(nightResolvesNegative.calculated.tiemposDifference, 0);
assert.equal(nightResolvesNegative.calculated.tiemposPendingAfterClosing, 0);

console.log("reconciliation ok");
