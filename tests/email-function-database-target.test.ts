import { describe, expect, it, vi } from "vitest";

import firebaseConfig from "../firebase.json";

import {
  handleEmailCreated,
  sendEmailTrigger,
  sendEmailTriggerRestauracion,
} from "../functions/index.js";

function endpointDatabase(trigger: unknown): string | undefined {
  return (trigger as {
    __endpoint?: { eventTrigger?: { eventFilters?: { database?: string } } };
  }).__endpoint?.eventTrigger?.eventFilters?.database;
}

function endpointDocument(trigger: unknown): string | undefined {
  return (trigger as {
    __endpoint?: {
      eventTrigger?: { eventFilterPathPatterns?: { document?: string } };
    };
  }).__endpoint?.eventTrigger?.eventFilterPathPatterns?.document;
}

describe("email Firestore triggers", () => {
  it("uses the deployed custom Functions codebase", () => {
    expect(firebaseConfig.functions[0].codebase).toBe("price-master");
  });

  it("listens to mail creation in the default production database", () => {
    expect(endpointDatabase(sendEmailTrigger)).toBe("(default)");
    expect(endpointDocument(sendEmailTrigger)).toBe("mail/{emailId}");
  });

  it("keeps a separate mail trigger for restauracion development", () => {
    expect(endpointDatabase(sendEmailTriggerRestauracion)).toBe(
      "restauracion",
    );
    expect(endpointDocument(sendEmailTriggerRestauracion)).toBe(
      "mail/{emailId}",
    );
  });

  it("updates the originating email document when processing fails", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await handleEmailCreated({
        data: {
          data: () => ({}),
          ref: { update },
        },
        params: { emailId: "mail-1" },
      });

      expect(result).toMatchObject({
        success: false,
        error: "Missing required email fields: to, subject",
      });
      expect(update).toHaveBeenCalledOnce();
      expect(update.mock.calls[0]?.[0]).toMatchObject({
        status: "failed",
        error: "Missing required email fields: to, subject",
      });
    } finally {
      errorLog.mockRestore();
    }
  });
});
