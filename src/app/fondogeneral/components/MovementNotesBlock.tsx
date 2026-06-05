import { AlertTriangle, CheckCircle, MessageSquare } from "lucide-react";

type MovementNotesBlockProps = {
  notes?: string | null;
};

export function MovementNotesBlock({ notes }: MovementNotesBlockProps) {
  if (!notes) {
    return null;
  }

  return (
    <div className="mt-1 flex w-full items-start gap-2 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1.5">
      <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
      <div className="text-xs text-[var(--muted-foreground)] break-words min-w-0 [&>div]:w-full">
        {(() => {
          if (notes.includes("[ALERT_ICON]")) {
            const parts = notes.split("\n");
            const headerText =
              parts.find((p) => !p.includes("[ALERT_ICON]")) || "";
            const alertLine =
              parts.find((p) => p.includes("[ALERT_ICON]")) || "";
            const noteText = alertLine.replace("[ALERT_ICON]", "");
            return (
              <div className="flex flex-col gap-1">
                {headerText && (
                  <div className="text-[10px] font-semibold text-[var(--foreground)] uppercase tracking-wide">
                    {headerText}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                  {(() => {
                    const isPositive = /:\s*\+/.test(noteText);
                    const isNegative = /:\s*\-/.test(noteText);
                    if (isPositive || isNegative) {
                      const bgClass = isPositive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-300";
                      return (
                        <span
                          className={`rounded border ${bgClass} px-1.5 py-0.5 text-[11px] font-semibold`}
                        >
                          {noteText}
                        </span>
                      );
                    }
                    return <span>{noteText}</span>;
                  })()}
                </div>
              </div>
            );
          }
          if (notes.startsWith("[CHECK_ICON]")) {
            const noteText = notes.replace("[CHECK_ICON]", "");
            return (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>{noteText}</span>
              </div>
            );
          }
          return <span>{notes}</span>;
        })()}
      </div>
    </div>
  );
}
