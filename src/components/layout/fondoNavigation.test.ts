import assert from "node:assert/strict";
import test from "node:test";
import * as fondoNavigation from "./fondoNavigation.ts";

const {
  isFondoSectionHash,
  isHomeTabId,
  TIEMPOS_TUCAN_TAB_ID,
} = fondoNavigation;

test("tiempostucan is recognized as a Fondo General section and home tab", () => {
  assert.equal(TIEMPOS_TUCAN_TAB_ID, "tiempostucan");
  assert.equal(isFondoSectionHash("#tiempostucan"), true);
  assert.equal(isHomeTabId("tiempostucan", false), true);
});

test("Tiempos/Tucan requires the reportetiempos permission", () => {
  const canAccessTiemposTucan = Reflect.get(
    fondoNavigation,
    "canAccessTiemposTucan",
  ) as
    | ((permissions?: { reportetiempos?: boolean }) => boolean)
    | undefined;

  assert.equal(typeof canAccessTiemposTucan, "function");
  if (!canAccessTiemposTucan) return;

  assert.equal(canAccessTiemposTucan({ reportetiempos: true }), true);
  assert.equal(canAccessTiemposTucan({ reportetiempos: false }), false);
  assert.equal(canAccessTiemposTucan({}), false);
  assert.equal(canAccessTiemposTucan(), false);
});
