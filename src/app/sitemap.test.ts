import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "./sitemap.ts";

test("the sitemap publishes the Gente Crystal privacy policy", () => {
  const urls = sitemap().map((entry) => entry.url);

  assert.ok(
    urls.includes(
      "https://www.timemaster.es/privacy/gente-crystal-extension",
    ),
  );
});
