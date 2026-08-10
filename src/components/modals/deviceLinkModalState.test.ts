import assert from "node:assert/strict";
import test from "node:test";
import { canApproveOrCancelDeviceLink } from "./deviceLinkModalState.ts";

test("canApproveOrCancelDeviceLink disables actions before QR is scanned", () => {
  assert.equal(canApproveOrCancelDeviceLink(null), false);
  assert.equal(canApproveOrCancelDeviceLink("pending"), false);
});

test("canApproveOrCancelDeviceLink enables actions when QR is scanned", () => {
  assert.equal(canApproveOrCancelDeviceLink("scanned"), true);
});

test("canApproveOrCancelDeviceLink disables actions after terminal statuses", () => {
  assert.equal(canApproveOrCancelDeviceLink("approved"), false);
  assert.equal(canApproveOrCancelDeviceLink("rejected"), false);
  assert.equal(canApproveOrCancelDeviceLink("expired"), false);
  assert.equal(canApproveOrCancelDeviceLink("used"), false);
});
