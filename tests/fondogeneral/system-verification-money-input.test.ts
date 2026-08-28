import { describe, expect, it } from "vitest";

import {
  formatSystemVerificationMoneyInput,
  normalizeSystemVerificationMoneyInput,
} from "@/utils/systemVerificationMoneyInput";

describe("system verification money input", () => {
  it.each([
    ["32700", "32700"],
    ["32 700", "32700"],
    ["32\u00a0700", "32700"],
    ["32\u202f700", "32700"],
    ["32.700", "32700"],
  ])("keeps %s as thirty-two thousand seven hundred", (raw, expected) => {
    expect(normalizeSystemVerificationMoneyInput(raw)).toBe(expected);
  });

  it.each([
    ["111111.02", "111111.02"],
    ["111 111,02", "111111.02"],
  ])("preserves the decimal amount in %s", (raw, expected) => {
    expect(normalizeSystemVerificationMoneyInput(raw)).toBe(expected);
  });

  it.each([
    ["32700", "32\u202f700"],
    ["32.700", "32\u202f700"],
    ["111111.02", "111\u202f111,02"],
  ])("formats %s with thin-space digit grouping", (raw, expected) => {
    expect(formatSystemVerificationMoneyInput(raw)).toBe(expected);
  });
});
