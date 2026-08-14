import { createElement, type ReactNode } from "react";

type GenteCrystalTicketTableFrameProps = {
  children?: ReactNode;
};

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
