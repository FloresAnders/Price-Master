/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

function loadDailyClosingsModule() {
  const filename = path.join(__dirname, "..", "src", "services", "daily-closings.ts");
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    exports: module.exports,
    module,
    require(request) {
      if (request === "firebase/firestore") {
        return {
          collection: () => ({}),
          doc: () => ({}),
          runTransaction: async () => {},
          serverTimestamp: () => ({}),
          setDoc: async () => {},
        };
      }
      if (request === "@/config/firebase") return { db: {} };
      if (request === "@/utils/serverTime") {
        return {
          getAuthoritativeNowISO: async () => "2026-07-18T05:16:26.438Z",
          getAuthoritativeNowMs: async () => 0,
        };
      }
      if (request === "./firestore") {
        return { FirestoreService: { getById: async () => null } };
      }
      if (request === "@/domain/reconciliation") {
        return { reconcileClosing: (record) => record };
      }
      return require(request);
    },
  };

  vm.runInNewContext(compiled, sandbox, { filename });
  return module.exports;
}

const {
  getOperationalDateKey,
  resolveOperationalDateKeyForSave,
} = loadDailyClosingsModule();

const schedule = {
  horarioApertura: "06:30",
  horarioCierre: "22:30",
  minutesAfterClose: 15,
};
const lateClosing = "2026-07-18T05:16:26.438Z";

assert.strictEqual(
  getOperationalDateKey(lateClosing, schedule),
  null,
  "strict horario window must reject this late closing",
);

assert.strictEqual(
  resolveOperationalDateKeyForSave(lateClosing, schedule, "2026-07-17"),
  "2026-07-17",
  "Fondo General save should accept authorized operational date from Fondo Ventas closing",
);

assert.strictEqual(
  resolveOperationalDateKeyForSave(lateClosing, schedule, null),
  null,
  "without authorized Fondo Ventas operational date, strict window still blocks",
);

console.log("daily closing operational window tests passed");
