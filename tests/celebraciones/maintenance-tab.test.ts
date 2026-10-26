import { describe, expect, it } from "vitest";
import {
  getMaintenanceTabs,
  isMaintenanceTabAllowed,
} from "@/edit/maintenanceTabs";

describe("celebrations maintenance tab", () => {
  it("is visible only to superadmins", () => {
    expect(isMaintenanceTabAllowed("seasonalEffects", "superadmin")).toBe(true);
    expect(isMaintenanceTabAllowed("seasonalEffects", "admin")).toBe(false);
    expect(isMaintenanceTabAllowed("seasonalEffects", "user")).toBe(false);
    expect(getMaintenanceTabs("superadmin").map((tab) => tab.key)).toContain(
      "seasonalEffects",
    );
  });
});
