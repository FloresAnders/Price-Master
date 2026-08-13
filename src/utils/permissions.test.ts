import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllPermissions,
  getDefaultPermissions,
  getNoPermissions,
} from "./permissions.ts";

test("reportetiempos follows the role permission defaults", () => {
  assert.equal(getDefaultPermissions("superadmin").reportetiempos, true);
  assert.equal(getDefaultPermissions("admin").reportetiempos, true);
  assert.equal(getDefaultPermissions("user").reportetiempos, false);
});

test("reportetiempos participates in select-all and select-none", () => {
  assert.equal(getAllPermissions().reportetiempos, true);
  assert.equal(getNoPermissions().reportetiempos, false);
});
