import { describe, expect, it } from "vitest";
import { resolveEmailChangeTargetUserId } from "@/lib/auth/email-change.server";
import type { UserPermissions } from "@/types/firestore";

type ActorInput = Parameters<typeof resolveEmailChangeTargetUserId>[0];

type TestUser = {
  id: string;
  role: "admin" | "user" | "superadmin";
  permissions?: Partial<UserPermissions>;
};

const user = (overrides: Partial<TestUser> = {}): ActorInput =>
  ({
    id: "u-self",
    role: "user",
    ...overrides,
  }) as unknown as ActorInput;

describe("resolveEmailChangeTargetUserId", () => {
  it("rejects anonymous callers", () => {
    expect(resolveEmailChangeTargetUserId(null, "u-other")).toBeNull();
    expect(resolveEmailChangeTargetUserId(undefined, "u-other")).toBeNull();
  });

  it("always allows a user to act on their own account", () => {
    expect(resolveEmailChangeTargetUserId(user(), "u-self")).toBe("u-self");
    expect(resolveEmailChangeTargetUserId(user(), "")).toBe("u-self");
    expect(
      resolveEmailChangeTargetUserId(user({ role: "admin" }), undefined),
    ).toBe("u-self");
  });

  it("denies a regular user acting on another account", () => {
    expect(resolveEmailChangeTargetUserId(user(), "u-other")).toBeNull();
  });

  it("allows admins and superadmins to act on another account", () => {
    expect(
      resolveEmailChangeTargetUserId(user({ role: "admin" }), "u-other"),
    ).toBe("u-other");
    expect(
      resolveEmailChangeTargetUserId(user({ role: "superadmin" }), "u-other"),
    ).toBe("u-other");
  });

  it("allows a user with the mantenimiento permission to act on another account", () => {
    expect(
      resolveEmailChangeTargetUserId(
        user({ permissions: { mantenimiento: true } }),
        "u-other",
      ),
    ).toBe("u-other");
  });

  it("trims whitespace from the requested id", () => {
    expect(
      resolveEmailChangeTargetUserId(user({ role: "admin" }), "  u-other  "),
    ).toBe("u-other");
  });
});
