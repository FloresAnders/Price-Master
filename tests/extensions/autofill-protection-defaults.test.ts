import { describe, expect, it } from "vitest";

import { normalizeSettings } from "../../extensions/ProteccionAutorrelleno/autofill-core.js";

describe("autofill protection defaults", () => {
  it("inicia sin URLs protegidas en una instalacion nueva", () => {
    expect(normalizeSettings().protectedUrls).toEqual([]);
  });
});
