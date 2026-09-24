import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Fondo ledger persistence boundaries", () => {
  it.each([
    "../../src/app/fondogeneral/components/layout/FondoSection.tsx",
    "../../src/app/fondogeneral/utils/closing/dailyClosing.ts",
    "../../src/app/fondogeneral/utils/fondo/mutations.ts",
  ])("does not save a full ledger from UI state in %s", (relativePath) => {
    const source = readFileSync(
      fileURLToPath(new URL(relativePath, import.meta.url)),
      "utf8",
    );
    expect(source).not.toContain("MovimientosFondosService.saveDocument(");
  });
});
