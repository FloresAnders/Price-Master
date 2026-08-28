// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DailyClosingModal from "@/app/fondogeneral/components/modals/DailyClosingModal";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("DailyClosingModal system verification inputs", () => {
  it("renders verification amounts with thin-space digit grouping", () => {
    render(
      <DailyClosingModal
        open
        onClose={() => undefined}
        onConfirm={async () => null}
        initialValues={{
          closingDate: "2026-08-27T12:00:00.000Z",
          manager: "Encargado",
          notes: "",
          totalCRC: 1_000,
          totalUSD: 0,
          breakdownCRC: { 1_000: 1 },
          breakdownUSD: {},
          turno: "D",
          r08: 32_700,
          t11: 500,
          tucanCumulative: 32_700,
          tiemposCumulative: 500,
        }}
        employees={["Encargado"]}
        loadingEmployees={false}
        currentBalanceCRC={1_000}
        currentBalanceUSD={0}
        turno="D"
        cierreFondoVentasMinutesBeforeEnd={0}
        cierreFondoVentasMinutesAfterEnd={0}
      />,
    );

    const verificationInputValues = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]'),
      (input) => input.value,
    );

    expect(verificationInputValues).toEqual([
      "32\u202f700",
      "32\u202f700",
      "500",
      "500",
    ]);
  });
});
