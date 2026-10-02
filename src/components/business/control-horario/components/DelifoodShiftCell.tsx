"use client";

import React from "react";
import type { ShiftOption } from "../types";
import { getCellStyle } from "../utils";
import { getDelifoodHoursTooltip } from "../delifoodShiftHours";

interface Props {
  value: string;
  hours?: number;
  disabled: boolean;
  shiftOptions: ShiftOption[];
  onChange: (value: string) => void;
  onOpenHours: () => void;
  fullMonthView?: boolean;
}

export default function DelifoodShiftCell({
  value,
  hours,
  disabled,
  shiftOptions,
  onChange,
  onOpenHours,
  fullMonthView = false,
}: Props) {
  const tooltip = value
    ? getDelifoodHoursTooltip(value, hours)
    : "Asignar turno";

  return (
    <select
      value={value}
      title={value ? tooltip : undefined}
      aria-label={tooltip}
      onChange={(event) => onChange(event.target.value)}
      onDoubleClick={(event) => {
        if (!disabled && value) {
          event.preventDefault();
          event.stopPropagation();
          onOpenHours();
        }
      }}
      disabled={disabled}
      className={`w-full h-full p-1 border-none outline-none text-center font-semibold cursor-pointer text-xs appearance-none ${disabled ? "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed" : ""}`}
      style={{
        ...getCellStyle(value),
        minWidth: fullMonthView ? "32px" : "40px",
        height: "40px",
      }}
    >
      {shiftOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
