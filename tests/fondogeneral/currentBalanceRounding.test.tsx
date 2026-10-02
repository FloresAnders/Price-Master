// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FondoCurrentBalanceCard } from "@/app/fondogeneral/components/FondoCurrentBalanceCard";

describe("FondoCurrentBalanceCard", () => {
  afterEach(cleanup);

  it("muestra el total firmado cuando hoy hubo redondeos", () => {
    render(
      <FondoCurrentBalanceCard
        enabledBalanceCurrencies={["CRC", "USD"]}
        currentBalanceCRC={310_000}
        currentBalanceUSD={120}
        formatByCurrency={(currency, amount) =>
          `${currency === "CRC" ? "₡" : "$"} ${amount.toLocaleString("es-CR")}`
        }
        todayRoundingSummary={{ total: -532, movementCount: 2 }}
      />,
    );

    expect(screen.getByText("Redondeo de hoy")).toBeTruthy();
    expect(screen.getByText("-₡ 532")).toBeTruthy();
  });

  it("permanece visible sin signo cuando los ajustes del día se cancelan", () => {
    render(
      <FondoCurrentBalanceCard
        enabledBalanceCurrencies={["CRC"]}
        currentBalanceCRC={310_000}
        currentBalanceUSD={0}
        formatByCurrency={(_currency, amount) => `₡ ${amount}`}
        todayRoundingSummary={{ total: 0, movementCount: 2 }}
      />,
    );

    expect(screen.getByText("Redondeo de hoy")).toBeTruthy();
    expect(screen.getByText("₡ 0")).toBeTruthy();
  });
});
