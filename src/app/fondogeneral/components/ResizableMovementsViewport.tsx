"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

const STORAGE_KEY = "fondogeneral-movements-height";
const MIN_HEIGHT = 280;
const MAX_HEIGHT = 1200;

const clampHeight = (height: number) =>
  Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(height)));

type ResizableMovementsViewportProps = {
  children: ReactNode;
};

export function ResizableMovementsViewport({
  children,
}: ResizableMovementsViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    currentHeight: number;
    moved: boolean;
    startHeight: number;
    startY: number;
  } | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    let savedHeight: number;
    try {
      savedHeight = Number.parseInt(
        window.localStorage.getItem(STORAGE_KEY) ?? "",
        10,
      );
    } catch {
      // La preferencia es opcional cuando el almacenamiento no está disponible.
      return;
    }

    if (!Number.isFinite(savedHeight)) return;
    const timeoutId = window.setTimeout(
      () => setHeight(clampHeight(savedHeight)),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const nextHeight = clampHeight(
        drag.startHeight + event.clientY - drag.startY,
      );
      drag.currentHeight = nextHeight;
      drag.moved = true;
      setHeight(nextHeight);
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;

      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (!drag.moved) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(drag.currentHeight));
      } catch {
        // El ajuste sigue funcionando durante la sesión aunque no se pueda guardar.
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const startHeight =
      height ?? viewportRef.current?.getBoundingClientRect().height ?? MIN_HEIGHT;

    event.preventDefault();
    dragRef.current = {
      currentHeight: startHeight,
      moved: false,
      startHeight,
      startY: event.clientY,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      <div
        ref={viewportRef}
        data-testid="fondo-movements-viewport"
        className="max-h-[28rem] overflow-y-auto sm:max-h-[36rem]"
        style={
          height === null
            ? undefined
            : { height: `${height}px`, maxHeight: `${height}px` }
        }
      >
        {children}
      </div>
      <div
        aria-label="Ajustar altura de movimientos"
        aria-orientation="horizontal"
        role="separator"
        title="Arrastra para cambiar la altura de los movimientos"
        onPointerDown={handlePointerDown}
        className="group flex h-3 cursor-row-resize touch-none items-center justify-center border-t border-[var(--input-border)] bg-[var(--card-bg)]/90 transition-colors hover:bg-cyan-950/45"
        style={{ touchAction: "none" }}
      >
        <span className="h-1 w-12 rounded-full bg-[var(--muted-foreground)]/45 transition-colors group-hover:bg-cyan-300/70" />
      </div>
    </>
  );
}
