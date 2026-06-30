import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const source = readFileSync("src/utils/controlHorarioManager.ts", "utf8");
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

const { getCashOpeningAvailabilityAfterDailyClosing } = sandboxModule.exports;

assert.equal(
  typeof getCashOpeningAvailabilityAfterDailyClosing,
  "function",
  "guard export missing",
);

const latestDayClosing = {
  id: "day-close",
  turno: "D",
  createdAt: "2026-06-30T15:55:00.000-06:00",
  closingDate: "2026-06-30T15:55:00.000-06:00",
};

assert.deepEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-06-30T15:56:00.000-06:00",
    horarioApertura: "08:00",
    latestDailyClosing: latestDayClosing,
    shiftChangeMin: 16 * 60,
  }),
  {
    allowed: false,
    closingTurno: "D",
    waitUntilLabel: "16:00",
    reason: "next_shift_not_started",
  },
);

assert.deepEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-06-30T16:00:00.000-06:00",
    horarioApertura: "08:00",
    latestDailyClosing: latestDayClosing,
    shiftChangeMin: 16 * 60,
  }),
  { allowed: true },
);

const latestNightClosing = {
  id: "night-close",
  turno: "N",
  createdAt: "2026-06-30T23:45:00.000-06:00",
  closingDate: "2026-06-30T23:59:00.000-06:00",
};

for (const nowISO of [
  "2026-06-30T23:46:00.000-06:00",
  "2026-07-01T07:59:00.000-06:00",
]) {
  assert.deepEqual(
    getCashOpeningAvailabilityAfterDailyClosing({
      nowISO,
      horarioApertura: "08:00",
      latestDailyClosing: latestNightClosing,
      shiftChangeMin: 16 * 60,
    }),
    {
      allowed: false,
      closingTurno: "N",
      waitUntilLabel: "08:00",
      reason: "next_day_shift_not_started",
    },
  );
}

assert.deepEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-07-01T08:00:00.000-06:00",
    horarioApertura: "08:00",
    latestDailyClosing: latestNightClosing,
    shiftChangeMin: 16 * 60,
  }),
  { allowed: true },
);

assert.deepEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-07-01T08:11:00.000-06:00",
    horarioApertura: "08:00",
    latestDailyClosing: {
      id: "late-night-close",
      turno: "N",
      createdAt: "2026-07-01T08:10:00.000-06:00",
      closingDate: "2026-06-30T23:59:00.000-06:00",
    },
    shiftChangeMin: 16 * 60,
  }),
  { allowed: true },
);
