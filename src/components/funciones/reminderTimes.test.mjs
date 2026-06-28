import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeReminderTimesCr,
  validateBlockSeconds,
  validateReminderTimesCr,
} from "./reminderTimes.ts";

test("normalizeReminderTimesCr merges legacy and array values", () => {
  assert.deepEqual(
    normalizeReminderTimesCr({
      reminderTimeCr: "08:30",
      reminderTimesCr: ["10:00", "", " 12:15 "],
    }),
    ["10:00", "12:15", "08:30"],
  );
});

test("normalizeReminderTimesCr accepts empty input", () => {
  assert.deepEqual(normalizeReminderTimesCr(undefined), []);
});

test("validateReminderTimesCr requires at least one valid HH:mm value", () => {
  assert.equal(
    validateReminderTimesCr(true, ["", "9:00"]).error,
    "Hora de recordatorio inválida (usa HH:mm).",
  );
  assert.deepEqual(validateReminderTimesCr(true, ["09:00"]).times, ["09:00"]);
  assert.deepEqual(validateReminderTimesCr(false, ["09:00"]).times, []);
});

test("validateBlockSeconds only persists positive whole seconds when enabled", () => {
  assert.deepEqual(validateBlockSeconds(false, "30"), {
    blockOnReminder: false,
    blockSeconds: undefined,
  });
  assert.deepEqual(validateBlockSeconds(true, "30"), {
    blockOnReminder: true,
    blockSeconds: 30,
  });
  assert.equal(
    validateBlockSeconds(true, "0").error,
    "Segundos de bloqueo inválidos.",
  );
  assert.equal(
    validateBlockSeconds(true, "1.5").error,
    "Segundos de bloqueo inválidos.",
  );
});
