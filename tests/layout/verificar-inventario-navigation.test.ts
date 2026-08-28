import { describe, expect, it } from "vitest";
import { isHomeTabId } from "@/components/layout/fondoNavigation";

describe("navegación de verificar inventario", () => {
  it("reconoce verificarinventario como una vista del inicio", () => {
    expect(isHomeTabId("verificarinventario", false)).toBe(true);
  });
});
