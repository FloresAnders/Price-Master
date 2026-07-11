import { readFileSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";

const source = readFileSync("src/services/closing-time-extensions.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: 1, target: 99 },
}).outputText;

const exports = {};
const cjsModule = { exports };
const require = () => ({});
new Function("exports", "module", "require", js)(exports, cjsModule, require);

const {
  buildClosingTimeExtensionId,
  ClosingTimeExtensionsService,
  getEffectiveMinutesAfterEnd,
  isApprovedClosingTimeExtensionUsable,
  normalizeClosingTimeExtensionCompanyKey,
} = cjsModule.exports;

assert.equal(
  normalizeClosingTimeExtensionCompanyKey(" Delikor Centro "),
  "delikor centro",
);

assert.equal(
  buildClosingTimeExtensionId(" Delikor Centro ", "2026-07-09", "D"),
  "delikor%20centro__2026-07-09__D",
);

assert.equal(
  buildClosingTimeExtensionId(" Delikor Centro ", "2026-07-09", "N"),
  "delikor%20centro__2026-07-09__N",
);

assert.equal(
  getEffectiveMinutesAfterEnd(45, {
    status: "approved",
    extraMinutes: 30,
    expiresAt: "2026-07-10T07:00:00.000Z",
  }, "2026-07-10T06:00:00.000Z"),
  75,
);

assert.equal(
  getEffectiveMinutesAfterEnd(45, {
    status: "pending",
    extraMinutes: 30,
    expiresAt: "2026-07-10T07:00:00.000Z",
  }, "2026-07-10T06:00:00.000Z"),
  45,
);

assert.equal(
  getEffectiveMinutesAfterEnd(45, {
    status: "approved",
    extraMinutes: 30,
    expiresAt: "2026-07-10T05:59:00.000Z",
  }, "2026-07-10T06:00:00.000Z"),
  45,
);

assert.equal(
  isApprovedClosingTimeExtensionUsable({
    status: "approved",
    extraMinutes: 0,
    expiresAt: "2026-07-10T07:00:00.000Z",
  }, "2026-07-10T06:00:00.000Z"),
  false,
);

assert.equal(
  isApprovedClosingTimeExtensionUsable({
    status: "rejected",
    extraMinutes: 30,
    expiresAt: "2026-07-10T07:00:00.000Z",
  }, "2026-07-10T06:00:00.000Z"),
  false,
);

assert.equal(
  isApprovedClosingTimeExtensionUsable({
    status: "used",
    extraMinutes: 30,
    expiresAt: "2026-07-10T07:00:00.000Z",
  }, "2026-07-10T06:00:00.000Z"),
  false,
);

assert.equal(typeof ClosingTimeExtensionsService.rejectNightExtension, "function");
assert.equal(typeof ClosingTimeExtensionsService.requestExtension, "function");
assert.equal(typeof ClosingTimeExtensionsService.approveExtension, "function");
assert.equal(typeof ClosingTimeExtensionsService.rejectExtension, "function");
assert.equal(typeof ClosingTimeExtensionsService.getAnsweredExtensionsByRequester, "function");
assert.equal(typeof ClosingTimeExtensionsService.markResponseSeen, "function");

console.log("closing-time-extensions tests passed");
