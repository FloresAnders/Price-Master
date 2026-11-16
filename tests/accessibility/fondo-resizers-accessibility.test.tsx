// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ColumnResizeHandle } from "@/app/fondogeneral/components/ColumnResizeHandle";
import { ResizableMovementsViewport } from "@/app/fondogeneral/components/ResizableMovementsViewport";

function ColumnHarness({ onPointerStart }: { onPointerStart: () => void }) {
  const [width, setWidth] = useState(120);
  return (
    <ColumnResizeHandle
      label="Ajustar columna Hora"
      value={width}
      onPointerStart={onPointerStart}
      onChange={setWidth}
    />
  );
}

describe("Fondo resizers", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("exposes column width and supports keyboard plus pointer input", () => {
    const onPointerStart = vi.fn();
    render(<ColumnHarness onPointerStart={onPointerStart} />);

    const separator = screen.getByRole("separator", {
      name: "Ajustar columna Hora",
    });
    expect(separator.tabIndex).toBe(0);
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("aria-valuenow")).toBe("120");

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator.getAttribute("aria-valuenow")).toBe("130");

    fireEvent.pointerDown(separator, {
      clientX: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(onPointerStart).toHaveBeenCalledTimes(1);
  });

  it("resizes the movements viewport with keyboard and touch pointer events", async () => {
    window.localStorage.setItem("fondogeneral-movements-height", "400");
    render(
      <ResizableMovementsViewport>
        <div>Movimientos</div>
      </ResizableMovementsViewport>,
    );

    const separator = screen.getByRole("separator", {
      name: "Ajustar altura de movimientos",
    });
    await waitFor(() => {
      expect(separator.getAttribute("aria-valuenow")).toBe("400");
    });
    expect(separator.tabIndex).toBe(0);
    expect(separator.getAttribute("aria-valuemin")).toBe("280");
    expect(separator.getAttribute("aria-valuemax")).toBe("1200");

    fireEvent.keyDown(separator, { key: "ArrowDown" });
    expect(separator.getAttribute("aria-valuenow")).toBe("410");

    fireEvent.pointerDown(separator, {
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerMove(window, {
      clientY: 140,
      pointerId: 2,
      pointerType: "touch",
    });
    expect(separator.getAttribute("aria-valuenow")).toBe("450");
  });
});
