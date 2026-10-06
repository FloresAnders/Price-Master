// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResizableMovementsViewport } from "@/app/fondogeneral/components/ResizableMovementsViewport";

describe("altura ajustable de movimientos del Fondo General", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 576,
      height: 576,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("amplía el área al arrastrar hacia abajo y recuerda la altura al soltar", () => {
    render(
      <ResizableMovementsViewport>
        <div>Movimiento de prueba</div>
      </ResizableMovementsViewport>,
    );

    const viewport = screen.getByTestId("fondo-movements-viewport");
    const handle = screen.getByRole("separator", {
      name: "Ajustar altura de movimientos",
    });

    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 550, pointerId: 1 });

    expect(viewport.style.height).toBe("726px");
    expect(
      window.localStorage.getItem("fondogeneral-movements-height"),
    ).toBeNull();

    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(window.localStorage.getItem("fondogeneral-movements-height")).toBe("726");
  });

  it("restaura la altura guardada al volver a abrir Fondo General", async () => {
    window.localStorage.setItem("fondogeneral-movements-height", "640");

    render(
      <ResizableMovementsViewport>
        <div>Movimiento de prueba</div>
      </ResizableMovementsViewport>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("fondo-movements-viewport").style.height).toBe(
        "640px",
      ),
    );
  });

  it("mantiene el ajuste dentro de límites utilizables", () => {
    render(
      <ResizableMovementsViewport>
        <div>Movimiento de prueba</div>
      </ResizableMovementsViewport>,
    );

    const viewport = screen.getByTestId("fondo-movements-viewport");
    const handle = screen.getByRole("separator", {
      name: "Ajustar altura de movimientos",
    });

    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(window, { clientY: 2400, pointerId: 1 });
    expect(viewport.style.height).toBe("1200px");
    fireEvent.pointerUp(window, { pointerId: 1 });

    fireEvent.pointerDown(handle, { clientY: 400, pointerId: 2 });
    fireEvent.pointerMove(window, { clientY: -2000, pointerId: 2 });
    expect(viewport.style.height).toBe("280px");
  });
});
