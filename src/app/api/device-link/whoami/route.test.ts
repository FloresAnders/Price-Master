import assert from "node:assert/strict";
import test from "node:test";
import { serializeDeviceLinkUser } from "./route.ts";

test("serializeDeviceLinkUser includes firestore document id", () => {
  assert.deepEqual(
    serializeDeviceLinkUser("user-123", { name: "DELIFOOD", role: "admin" }),
    { id: "user-123", name: "DELIFOOD", role: "admin" },
  );
});

test("serializeDeviceLinkUser preserves firestore id over stored id", () => {
  assert.deepEqual(
    serializeDeviceLinkUser("user-123", { id: "wrong-id", name: "DELIFOOD" }),
    { id: "user-123", name: "DELIFOOD" },
  );
});

test("serializeDeviceLinkUser removes stored password", () => {
  assert.deepEqual(
    serializeDeviceLinkUser("user-123", {
      name: "PALMARES",
      password: "secret",
    }),
    { id: "user-123", name: "PALMARES" },
  );
});

test("serializeDeviceLinkUser keeps missing users absent", () => {
  assert.equal(serializeDeviceLinkUser("user-123", undefined), null);
});
