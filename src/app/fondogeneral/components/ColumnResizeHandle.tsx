"use client";

import type { KeyboardEvent, PointerEvent } from "react";

export const COLUMN_MIN_WIDTH = 40;
export const COLUMN_MAX_WIDTH = 600;
const COLUMN_RESIZE_STEP = 10;

type ColumnResizeHandleProps = {
  label: string;
  value: number;
  onPointerStart: (event: PointerEvent<HTMLDivElement>) => void;
  onChange: (value: number) => void;
};

const clampWidth = (value: number) =>
  Math.min(COLUMN_MAX_WIDTH, Math.max(COLUMN_MIN_WIDTH, value));

export function ColumnResizeHandle({
  label,
  value,
  onPointerStart,
  onChange,
}: ColumnResizeHandleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | null = null;
    if (event.key === "ArrowLeft") nextWidth = value - COLUMN_RESIZE_STEP;
    if (event.key === "ArrowRight") nextWidth = value + COLUMN_RESIZE_STEP;
    if (event.key === "Home") nextWidth = COLUMN_MIN_WIDTH;
    if (event.key === "End") nextWidth = COLUMN_MAX_WIDTH;
    if (nextWidth === null) return;

    event.preventDefault();
    onChange(clampWidth(nextWidth));
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={COLUMN_MIN_WIDTH}
      aria-valuemax={COLUMN_MAX_WIDTH}
      aria-valuenow={value}
      aria-valuetext={`${value} pixeles`}
      tabIndex={0}
      title="Arrastra o usa las flechas izquierda y derecha para cambiar el ancho"
      onPointerDown={onPointerStart}
      onKeyDown={handleKeyDown}
      className="absolute top-0 right-0 flex h-full min-w-6 w-8 -mr-3 cursor-col-resize touch-pan-y items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300"
      style={{ touchAction: "pan-y" }}
    >
      <span
        aria-hidden="true"
        className="h-[70%] w-0.5 rounded bg-white/20"
      />
    </div>
  );
}
