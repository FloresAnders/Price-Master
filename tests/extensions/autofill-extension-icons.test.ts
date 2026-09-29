import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const extensionRoot = resolve("extensions/ProteccionAutorrelleno");

function readPngDimensions(relativePath: string) {
  const png = readFileSync(resolve(extensionRoot, relativePath));
  expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe("autofill protection extension icons", () => {
  it("empaqueta iconos PNG del tamano declarado para la extension y su accion", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(extensionRoot, "manifest.json"), "utf8"),
    );
    const expectedIcons = {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    };

    expect(manifest.icons).toEqual(expectedIcons);
    expect(manifest.action.default_icon).toEqual(expectedIcons);

    for (const [size, relativePath] of Object.entries(expectedIcons)) {
      expect(readPngDimensions(relativePath)).toEqual({
        width: Number(size),
        height: Number(size),
      });
    }
  });
});
