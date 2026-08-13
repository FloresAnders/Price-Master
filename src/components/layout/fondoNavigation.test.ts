import assert from "node:assert/strict";
import test from "node:test";
import {
  isFondoSectionHash,
  isHomeTabId,
  TIEMPOS_TUCAN_TAB_ID,
} from "./fondoNavigation.ts";

test("tiempostucan is recognized as a Fondo General section and home tab", () => {
  assert.equal(TIEMPOS_TUCAN_TAB_ID, "tiempostucan");
  assert.equal(isFondoSectionHash("#tiempostucan"), true);
  assert.equal(isHomeTabId("tiempostucan", false), true);
});
