import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/services/email-templates/daily-closing.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
  require: () => ({}),
  Intl,
  Date,
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox);

const { buildDailyClosingEmailTemplate } = sandbox.module.exports;

const reconciliation = {
  contica: { r08: 12345, t11: 67890 },
  externalSnapshots: { tucanCumulative: 100000, tiemposCumulative: 200000 },
  calculated: {
    previousTucanCumulative: 0,
    previousTiemposCumulative: 0,
    tucanForShift: 12000,
    tiemposForShift: 70000,
    tucanDifference: 345,
    tiemposRawDifference: -2110,
    previousTiemposPending: 5000,
    compensatedTiemposAmount: 2110,
    tiemposRealShiftDifference: 0,
    tiemposPendingAfterClosing: 0,
    cumulativeR08: 12345,
    cumulativeT11: 67890,
    cumulativeTucanDifference: -87655,
    cumulativeTiemposDifference: -132110,
  },
  tiemposStatus: "RESOLVED",
};

const template = buildDailyClosingEmailTemplate({
  company: "Demo",
  accountKey: "general",
  closingDateISO: "2026-06-26T12:00:00.000Z",
  manager: "Admin",
  totalCRC: 1,
  totalUSD: 0,
  recordedBalanceCRC: 1,
  recordedBalanceUSD: 0,
  diffCRC: 0,
  diffUSD: 0,
  reconciliation,
});

const output = `${template.text}\n${template.html}`;

for (const expected of ["₡12 345", "₡67 890", "₡12 000", "₡70 000", "₡345", "₡2 110", "₡100 000", "₡200 000"]) {
  assert.match(output, new RegExp(expected.replace(/\u00a0/g, "[\\s\\u00a0]")));
}

for (const raw of ["R08: 12345", "T11: 67890", "Tucan: 12000", "Tiempos: 70000", "se compensaron 2110"]) {
  assert.doesNotMatch(output, new RegExp(raw));
}
