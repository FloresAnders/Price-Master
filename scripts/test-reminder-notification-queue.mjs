import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const source = readFileSync("src/components/funciones/reminderQueue.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

const sandboxModule = { exports: {} };
new Function("exports", "require", "module", compiled)(
  sandboxModule.exports,
  require,
  sandboxModule,
);

const { groupReminderSources } = sandboxModule.exports;

const result = groupReminderSources({
  dateKey: "2026-07-02",
  firedKeys: new Set(),
  pendingKeys: new Set(),
  items: [
    {
      empresaId: "AAA",
      empresaName: "AAA",
      funcionId: "0001",
      funcionNombre: "A-AAAA",
      reminderTimeCr: "11:30",
      blockOnReminder: true,
      blockSeconds: 30,
    },
    {
      empresaId: "AAA",
      empresaName: "AAA",
      funcionId: "0002",
      funcionNombre: "AAA",
      reminderTimeCr: "11:30",
      blockOnReminder: true,
      blockSeconds: 45,
    },
  ],
});

assert.equal(result.queued.length, 1);
assert.equal(result.queued[0].funciones.length, 2);
assert.equal(result.queued[0].blockOnReminder, true);
assert.equal(result.queued[0].blockSeconds, 45);
assert.deepEqual(result.pendingKeys, [
  "2026-07-02|AAA|0001|11:30",
  "2026-07-02|AAA|0002|11:30",
]);

const filtered = groupReminderSources({
  dateKey: "2026-07-02",
  firedKeys: new Set(["2026-07-02|AAA|0001|11:30"]),
  pendingKeys: new Set(["2026-07-02|AAA|0002|11:30"]),
  items: [
    {
      empresaId: "AAA",
      empresaName: "AAA",
      funcionId: "0001",
      funcionNombre: "A-AAAA",
      reminderTimeCr: "11:30",
      blockOnReminder: true,
      blockSeconds: 30,
    },
    {
      empresaId: "AAA",
      empresaName: "AAA",
      funcionId: "0002",
      funcionNombre: "AAA",
      reminderTimeCr: "11:30",
      blockOnReminder: true,
      blockSeconds: 45,
    },
  ],
});

assert.equal(filtered.queued.length, 0);
assert.deepEqual(filtered.pendingKeys, []);

console.log("reminder notification queue ok");
