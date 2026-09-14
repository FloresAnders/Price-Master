import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

function loadCore() {
  try {
    return require("../extensions/SumaTiempos/sumatiempos-core.js");
  } catch {
    return {};
  }
}

const {
  calculateTotals,
  parseCurrency,
  parseNumbers,
} = loadCore();

describe("SumaTiempos calculations", () => {
  test("counts valid one and two digit numbers including 00", () => {
    expect(parseNumbers?.("55  22,33; 00 | 66")).toEqual([
      "55",
      "22",
      "33",
      "00",
      "66",
    ]);
    expect(parseNumbers?.("100 foo")).toEqual([]);
  });

  test.each([
    ["₡ 1,250.50", 1250.5],
    ["1250", 1250],
    ["1.250,50", 1250.5],
    ["", 0],
    ["abc", 0],
  ])("parses currency %s", (value, expected) => {
    expect(parseCurrency?.(value)).toBe(expected);
  });

  test("combines ticket, normal and active companion amounts", () => {
    expect(calculateTotals?.({
      numbersText: "55 22 33",
      mainAmount: "100",
      companionAmount: "50",
      companionActive: true,
      ticketTotal: "₡ 200.00",
    })).toEqual({
      numberCount: 3,
      mainPerNumber: 100,
      companionPerNumber: 50,
      ticketTotal: 200,
      captureTotal: 450,
      grandTotal: 650,
    });
  });

  test("ignores a hidden companion amount", () => {
    expect(calculateTotals?.({
      numbersText: "05 06",
      mainAmount: "100",
      companionAmount: "500",
      companionActive: false,
      ticketTotal: "₡ 0.00",
    })?.grandTotal).toBe(200);
  });
});
