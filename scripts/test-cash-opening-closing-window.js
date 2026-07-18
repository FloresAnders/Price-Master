/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

function loadControlHorarioManager() {
  const filename = path.join(
    __dirname,
    "..",
    "src",
    "utils",
    "controlHorarioManager.ts",
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
        return require(request);
      },
    },
    { filename },
  );
  return loadedModule.exports;
}

const { getCashOpeningAvailabilityAfterDailyClosing } =
  loadControlHorarioManager();

const latestDayClosing = {
  turno: "D",
  closingDate: "2026-07-18T01:50:00.000Z", // 19:50 Costa Rica
};

assert.strictEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-07-18T01:50:00.000Z", // 19:50 Costa Rica
    horarioApertura: "06:00",
    horarioCierre: "22:00",
    latestDailyClosing: latestDayClosing,
    shiftChangeMin: 1200,
    cierreFondoVentasMinutesBeforeEnd: 15,
    cierreFondoVentasMinutesAfterEnd: 45,
  }).allowed,
  true,
  "apertura debe permitirse dentro del mismo rango de cierre fondo ventas",
);

assert.strictEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-07-18T01:30:00.000Z", // 19:30 Costa Rica
    horarioApertura: "06:00",
    horarioCierre: "22:00",
    latestDailyClosing: latestDayClosing,
    shiftChangeMin: 1200,
    cierreFondoVentasMinutesBeforeEnd: 15,
    cierreFondoVentasMinutesAfterEnd: 45,
  }).allowed,
  false,
  "apertura fuera del rango sigue bloqueada",
);

assert.strictEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-07-18T01:50:00.000Z", // 19:50 Costa Rica
    horarioApertura: "06:00",
    horarioCierre: "22:00",
    latestDailyClosing: latestDayClosing,
    shiftChangeMin: 1200,
  }).allowed,
  false,
  "sin rango de cierre configurado conserva bloqueo anterior",
);

assert.strictEqual(
  getCashOpeningAvailabilityAfterDailyClosing({
    nowISO: "2026-07-18T04:30:00.000Z", // 22:30 Costa Rica
    horarioApertura: "06:00",
    horarioCierre: "22:00",
    latestDailyClosing: {
      turno: "N",
      closingDate: "2026-07-18T04:00:00.000Z",
    },
    cierreFondoVentasMinutesBeforeEnd: 15,
    cierreFondoVentasMinutesAfterEnd: 45,
  }).allowed,
  true,
  "apertura nocturna debe permitirse dentro del rango de cierre fondo ventas",
);

console.log("cash opening closing window tests passed");
