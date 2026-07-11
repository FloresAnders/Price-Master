import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sourcePath = new URL(
  "../src/components/calculator/priceCalculatorLogic.ts",
  import.meta.url,
);

assert.equal(existsSync(sourcePath), true, "priceCalculatorLogic.ts exists");

const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const loadedModule = { exports: {} };
new Script(compiled.outputText).runInNewContext({
  exports: loadedModule.exports,
  module: loadedModule,
  require,
});

const {
  redondearPrecioFinal,
  dividirPrecioFinal,
  ROUNDING_MODES,
} = loadedModule.exports;

assert.equal(redondearPrecioFinal(112), 100);
assert.equal(redondearPrecioFinal(113), 125);
assert.equal(redondearPrecioFinal(137), 125);
assert.equal(redondearPrecioFinal(138), 150);
assert.equal(redondearPrecioFinal(187), 175);
assert.equal(redondearPrecioFinal(188), 200);

assert.equal(ROUNDING_MODES.NEAREST, "nearest");
assert.equal(ROUNDING_MODES.DOWN, "down");
assert.equal(ROUNDING_MODES.UP, "up");

assert.equal(dividirPrecioFinal(1000, 3, "nearest"), 325);
assert.equal(dividirPrecioFinal(1000, 3, "down"), 325);
assert.equal(dividirPrecioFinal(1000, 3, "up"), 350);
assert.equal(dividirPrecioFinal(1000, 4, "nearest"), 250);
assert.equal(dividirPrecioFinal(1000, 0, "nearest"), null);
assert.equal(dividirPrecioFinal(1000, -2, "nearest"), null);

console.log("price calculator logic ok");
