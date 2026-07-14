/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

function loadTsModule(relativePath) {
  const filePath = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = {
    exports: cjsModule.exports,
    module: cjsModule,
    require,
  };
  vm.runInNewContext(compiled, context, { filename: filePath });
  return cjsModule.exports;
}

const {
  parseRegistroTucanAmount,
  calculateRegistroTucanTotal,
  formatRegistroTucanDateInput,
  formatRegistroTucanTimeInput,
  buildRegistroTucanEmpresaDocId,
} = loadTsModule("src/utils/registroTucan.ts");

assert.strictEqual(parseRegistroTucanAmount("₡1,234.50"), 1234.5);
assert.strictEqual(parseRegistroTucanAmount("1 234,50"), 1234.5);
assert.strictEqual(parseRegistroTucanAmount(""), 0);
assert.strictEqual(parseRegistroTucanAmount("abc"), 0);

assert.strictEqual(
  calculateRegistroTucanTotal({
    saldoPaginaTucan: 100,
    saldoFondoTucan: 25.25,
    pagosHoy: 10.1,
  }),
  135.35,
);

assert.strictEqual(formatRegistroTucanDateInput(new Date("2026-07-13T18:30:00Z")), "2026-07-13");
assert.strictEqual(formatRegistroTucanDateInput(new Date(2026, 6, 13, 23, 30)), "2026-07-13");
assert.strictEqual(formatRegistroTucanTimeInput(new Date(2026, 6, 13, 9, 5, 7)), "09:05:07");
assert.strictEqual(buildRegistroTucanEmpresaDocId("Delikor / San José"), "DELIKOR_SAN_JOSE");

console.log("Registro Tucan logic tests passed");
