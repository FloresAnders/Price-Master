import { createElement, type ReactNode } from "react";

type GenteCrystalTicketTableFrameProps = {
  children?: ReactNode;
};

type GenteCrystalTicketNumbersProps = {
  ticketIds: string[];
  showFullTicket: boolean;
};

type GenteCrystalTicketViewToggleProps = {
  showFullTicket: boolean;
  onToggle: () => void;
};

export function GenteCrystalTicketNumbers({
  ticketIds,
  showFullTicket,
}: GenteCrystalTicketNumbersProps) {
  return createElement(
    "span",
    { className: "inline-flex flex-col" },
    ticketIds.map((ticketId) =>
      createElement(
        "span",
        { key: ticketId, className: "block" },
        showFullTicket ? ticketId : ticketId.split("-").at(-1) || ticketId,
      ),
    ),
  );
}

export function GenteCrystalTicketViewToggle({
  showFullTicket,
  onToggle,
}: GenteCrystalTicketViewToggleProps) {
  return createElement(
    "button",
    {
      type: "button",
      "aria-pressed": showFullTicket,
      onClick: onToggle,
      className: `inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold transition ${
        showFullTicket
          ? "border-emerald-500/55 bg-emerald-950/30 text-emerald-100 hover:bg-emerald-950/45"
          : "border-[var(--input-border)] bg-[var(--card-bg)]/70 text-[var(--foreground)] hover:border-cyan-500/55 hover:bg-cyan-950/20"
      }`,
    },
    "Tiquete completo",
  );
}

export function GenteCrystalTicketTableFrame({
  children,
}: GenteCrystalTicketTableFrameProps) {
  return createElement(
    "div",
    {
      className:
        "w-fit max-w-full overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70",
    },
    createElement(
      "div",
      { className: "max-w-full overflow-x-auto" },
      createElement(
        "table",
        { className: "w-max max-w-none text-left text-sm" },
        children,
      ),
    ),
  );
}
