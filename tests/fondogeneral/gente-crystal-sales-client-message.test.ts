import { describe, expect, it } from "vitest";

import {
  GenteCrystalSalesClientError,
  messageForGenteCrystalSalesError,
} from "@/services/gente-crystal-sales";

describe("messageForGenteCrystalSalesError", () => {
  it("explica cuando un user actualiza fuera de las ventanas de cierre", () => {
    expect(
      messageForGenteCrystalSalesError(
        new GenteCrystalSalesClientError(403, "update_window_closed"),
      ),
    ).toBe(
      "Solo puedes actualizar Tiempos durante la ventana de cierre del turno D o N.",
    );
  });
});
