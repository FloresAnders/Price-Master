import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const headerPath = path.join(
  process.cwd(),
  "src",
  "components",
  "layout",
  "Header.tsx",
);

describe("Header responsive user actions", () => {
  it("keeps the desktop logout action hidden while the mobile menu is active", async () => {
    const source = await readFile(headerPath, "utf8");
    const desktopUserActions = source.match(
      /\{\(user \|\| pathname === "\/home"\) && \(\s*<div className="([^"]+)"/,
    );

    expect(desktopUserActions?.[1].split(/\s+/)).toEqual(
      expect.arrayContaining(["hidden", "lg:flex"]),
    );
  });
});
