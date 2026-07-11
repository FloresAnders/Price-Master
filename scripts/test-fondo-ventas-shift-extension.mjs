import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";

const source = readFileSync("src/utils/controlHorarioManager.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: 1, target: 99 },
}).outputText;

const exports = {};
const cjsModule = { exports };
new Function("exports", "module", js)(exports, cjsModule);

const { resolveFondoVentasClosingShift } = cjsModule.exports;

assert.equal(
  resolveFondoVentasClosingShift({
    currentMin: 20 * 60 + 20,
    shiftDEndMin: 20 * 60,
    shiftNEndMin: 24 * 60,
    expectedShift: "N",
    minutesBeforeEnd: 15,
    minutesAfterEnd: 10,
    minutesAfterEndByShift: { D: 30, N: 10 },
    occupiedShifts: new Set(),
  }),
  "D",
);

assert.equal(
  resolveFondoVentasClosingShift({
    currentMin: 30,
    shiftDEndMin: 20 * 60,
    shiftNEndMin: 24 * 60,
    expectedShift: "N",
    minutesBeforeEnd: 15,
    minutesAfterEnd: 10,
    minutesAfterEndByShift: { D: 10, N: 45 },
    occupiedShifts: new Set(["D"]),
  }),
  "N",
);

assert.equal(
  resolveFondoVentasClosingShift({
    currentMin: 11 * 60 + 5,
    shiftDEndMin: 10 * 60 + 15,
    shiftNEndMin: 13 * 60 + 15,
    expectedShift: "N",
    minutesBeforeEnd: 15,
    minutesAfterEnd: 45,
    occupiedShifts: new Set(),
  }),
  "D",
);

assert.equal(
  resolveFondoVentasClosingShift({
    currentMin: 11 * 60 + 46,
    shiftDEndMin: 10 * 60 + 15,
    shiftNEndMin: 13 * 60 + 15,
    expectedShift: "N",
    minutesBeforeEnd: 15,
    minutesAfterEnd: 45,
    occupiedShifts: new Set(),
  }),
  "N",
);

console.log("fondo-ventas-shift-extension tests passed");
