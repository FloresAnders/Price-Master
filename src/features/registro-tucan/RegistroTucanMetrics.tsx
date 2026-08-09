import { iconBoxClass, sectionClass } from "./styles";
import type { RegistroTucanMetricCard } from "./types";

type RegistroTucanMetricsProps = {
  cards: RegistroTucanMetricCard[];
  formatCRC: (value: number) => string;
};

export function RegistroTucanMetrics({
  cards,
  formatCRC,
}: RegistroTucanMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <div key={label} className={sectionClass}>
          <div className="flex items-center gap-3">
            <div className={iconBoxClass}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                {label}
              </p>
              <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
                {formatCRC(value)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
