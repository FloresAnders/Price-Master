"use client";

import FestivityArtwork from "@/components/celebraciones/assets/FestivityArtwork";
import type { FestivityConfig } from "@/components/celebraciones/types";

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-600" />
      <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

interface SeasonalEffectsCelebrationCardProps {
  config: FestivityConfig;
  dateLabel: string;
  selected: boolean;
  onSelect: () => void;
  onEnabledChange: (enabled: boolean) => void;
}

export default function SeasonalEffectsCelebrationCard({
  config,
  dateLabel,
  selected,
  onSelect,
  onEnabledChange,
}: SeasonalEffectsCelebrationCardProps) {
  return (
    <article
      className={`relative min-w-0 rounded-xl border px-2.5 py-2 transition-colors ${
        selected
          ? "border-blue-500 bg-[var(--card-bg)]"
          : "border-transparent bg-[var(--hover-bg)]/45 hover:bg-[var(--hover-bg)]"
      }`}
    >
      <button
        type="button"
        aria-label={`Editar ${config.title}`}
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-h-11 w-full items-center gap-2.5 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--card-bg)] text-blue-500 shadow-sm">
          <FestivityArtwork id={config.id} className="h-8 w-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
            {config.title}
          </span>
          <span className="block truncate text-xs text-[var(--muted-foreground)]">
            {dateLabel}
          </span>
        </span>
      </button>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
        <ToggleSwitch
          checked={config.enabled}
          onCheckedChange={onEnabledChange}
          label={`Habilitar ${config.title}`}
        />
      </span>
    </article>
  );
}
