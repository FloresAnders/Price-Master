import { describe, expect, it } from "vitest";
import { reconcileAccountCashCounters } from "@/components/business/cash-counter-tabs/accountCounters";
import { FONDO_ACCOUNT_TABS } from "@/lib/fondoAccountTabs";

describe("reconciliación de contadores de cuentas", () => {
  it("no convierte un contador personalizado aunque tenga el mismo nombre", () => {
    const customCounter = {
      name: "Cuenta BCR",
      bills: { 1000: 2 },
      extraAmount: 0,
      currency: "CRC" as const,
      aperturaCaja: 0,
      ventaActual: 0,
    };
    const bcrAccount = FONDO_ACCOUNT_TABS.filter(
      (account) => account.accountId === "BCR",
    );

    const reconciled = reconcileAccountCashCounters(
      [customCounter],
      bcrAccount,
    );

    expect(reconciled).toHaveLength(2);
    expect(reconciled[0]).toEqual(customCounter);
    expect(reconciled[1]).toMatchObject({
      accountId: "BCR",
      name: "Cuenta BCR",
    });
  });
});
