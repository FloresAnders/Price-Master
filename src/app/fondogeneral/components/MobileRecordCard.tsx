import type { ReactNode } from "react";

export type MobileRecordDetail = {
  label: string;
  value: ReactNode;
};

type MobileRecordCardProps = {
  ariaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
  dateTime?: ReactNode;
  amount?: ReactNode;
  badges?: ReactNode;
  details?: MobileRecordDetail[];
  expandedContent?: ReactNode;
  actions?: ReactNode;
  dimmed?: boolean;
};

export function MobileRecordCard({
  ariaLabel,
  title,
  subtitle,
  dateTime,
  amount,
  badges,
  details = [],
  expandedContent,
  actions,
  dimmed = false,
}: MobileRecordCardProps) {
  return (
    <article
      aria-label={ariaLabel}
      className={`min-w-0 break-words rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)]/92 p-4 shadow-sm [&_button]:min-h-11 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-w-0 break-words text-base font-semibold text-[var(--foreground)]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 min-w-0 break-words text-xs text-[var(--muted-foreground)]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {dateTime ? (
          <div className="max-w-[45%] shrink-0 text-right text-xs text-[var(--muted-foreground)]">
            {dateTime}
          </div>
        ) : null}
      </header>

      {amount || badges ? (
        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
          {amount ? (
            <div className="min-w-0 break-words text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {amount}
            </div>
          ) : null}
          {badges ? (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {badges}
            </div>
          ) : null}
        </div>
      ) : null}

      {details.length > 0 ? (
        <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 border-t border-[var(--input-border)]/70 pt-4">
          {details.map((detail, index) => (
            <div key={`${detail.label}-${index}`} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {detail.label}
              </dt>
              <dd className="mt-1 min-w-0 break-words text-sm text-[var(--foreground)]">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {expandedContent ? (
        <div className="mt-4 min-w-0 border-t border-[var(--input-border)]/70 pt-4">
          {expandedContent}
        </div>
      ) : null}

      {actions ? (
        <div className="mt-4 grid min-h-11 min-w-0 gap-2 border-t border-[var(--input-border)]/70 pt-4 empty:hidden [&>button]:min-h-11 [&>button]:w-full">
          {actions}
        </div>
      ) : null}
    </article>
  );
}
