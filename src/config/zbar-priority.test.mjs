import assert from "node:assert/strict";
import test from "node:test";

import {
  createStableCodeDetector,
  isAcceptedBarcodeValue,
} from "./zbar-priority.ts";

test("isAcceptedBarcodeValue validates numeric retail checksums", () => {
  assert.equal(isAcceptedBarcodeValue("7501055300075"), true);
  assert.equal(isAcceptedBarcodeValue("7501055300076"), false);
  assert.equal(isAcceptedBarcodeValue("036000291452"), true);
  assert.equal(isAcceptedBarcodeValue("036000291453"), false);
});

test("isAcceptedBarcodeValue rejects debug and broad false-positive values", () => {
  assert.equal(isAcceptedBarcodeValue("BASIC_EAN_DIGITS_123456789012"), false);
  assert.equal(isAcceptedBarcodeValue("A1-B2-C3-D4"), false);
});

test("createStableCodeDetector accepts only repeated identical reads", () => {
  const detector = createStableCodeDetector(3);

  assert.equal(detector("7501055300075"), null);
  assert.equal(detector("036000291452"), null);
  assert.equal(detector("7501055300075"), null);
  assert.equal(detector("7501055300075"), null);
  assert.equal(detector("7501055300075"), "7501055300075");
});
