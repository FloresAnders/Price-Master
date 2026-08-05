/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

function loadSingleClosingReasonModule() {
  const filename = path.join(
    __dirname,
    "..",
    "src",
    "app",
    "fondogeneral",
    "utils",
    "closing",
    "singleClosingReason.ts",
  );
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const loadedModule = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      exports: loadedModule.exports,
      module: loadedModule,
      require(request) {
        if (request === "../../constants") {
          return {
            SINGLE_CLOSING_REASON_MIN_LENGTH: 10,
            SINGLE_CLOSING_REASON_PREFIX:
              "MOTIVO DE UN SOLO CIERRE EN EL DIA: ",
          };
        }
        return require(request);
      },
    },
    { filename },
  );
  return loadedModule.exports;
}

const {
  getSingleClosingReasonFromNotes,
  hasMinimumSingleClosingReasonLength,
} = loadSingleClosingReasonModule();

assert.strictEqual(
  getSingleClosingReasonFromNotes("MOTIVO DE UN SOLO CIERRE EN EL DIA: M"),
  "M",
  "debe extraer solo el motivo despues del prefijo",
);

assert.strictEqual(
  hasMinimumSingleClosingReasonLength("M"),
  false,
  "debe rechazar motivos de menos de 10 caracteres",
);

assert.strictEqual(
  hasMinimumSingleClosingReasonLength("1234567890"),
  true,
  "debe aceptar motivos de 10 caracteres",
);

console.log("single closing reason tests passed");
