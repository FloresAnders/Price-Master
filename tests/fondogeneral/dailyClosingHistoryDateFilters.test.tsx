// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DailyClosingHistorySection from "@/components/daily-closings/DailyClosingHistorySection";

describe("filtros de fecha del historial de cierres", () => {
  it("ofrece los rangos de este año y año anterior", () => {
    const view = render(
      <DailyClosingHistorySection
        closingsAreLoading={false}
        dailyClosings={[]}
        quickRange="today"
        onQuickRangeChange={vi.fn()}
        dailyClosingDateFormatter={new Intl.DateTimeFormat("es-CR")}
        dateTimeFormatter={new Intl.DateTimeFormat("es-CR")}
        buildBreakdownLines={() => []}
        formatByCurrency={(_, value) => String(value)}
        formatDailyClosingDiff={(_, value) => String(value)}
        getDailyClosingDiffClass={() => ""}
        fondoEntries={[]}
        isAutoAdjustmentProvider={() => false}
        expandedClosings={new Set()}
        setExpandedClosings={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Este año" }).getAttribute("value"),
    ).toBe("year");
    expect(
      screen
        .getByRole("option", { name: "Año anterior" })
        .getAttribute("value"),
    ).toBe("lastyear");
    view.unmount();
  });
});
