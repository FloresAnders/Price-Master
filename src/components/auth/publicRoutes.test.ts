import assert from "node:assert/strict";
import test from "node:test";
import { isPublicRoute } from "./publicRoutes.ts";

test("the Gente Crystal privacy policy is accessible without a session", () => {
  assert.equal(isPublicRoute("/privacy/gente-crystal-extension"), true);
});
