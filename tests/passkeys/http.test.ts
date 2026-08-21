import { describe, expect, it } from "vitest";
import {
  BROWSER_BINDING_COOKIE,
  ensureBrowserBinding,
  getBrowserBinding,
} from "@/lib/passkeys/http.server";

describe("passkey browser binding", () => {
  it("reutiliza una vinculación existente", () => {
    const request = new Request("https://timemaster.example", {
      headers: { cookie: `${BROWSER_BINDING_COOKIE}=existing-binding` },
    });

    expect(getBrowserBinding(request)).toBe("existing-binding");
    expect(ensureBrowserBinding(request, () => "new-binding")).toEqual({
      value: "existing-binding",
      isNew: false,
    });
  });

  it("crea una vinculación cuando el navegador aún no tiene cookie", () => {
    const request = new Request("https://timemaster.example");

    expect(getBrowserBinding(request)).toBeNull();
    expect(ensureBrowserBinding(request, () => "new-binding")).toEqual({
      value: "new-binding",
      isNew: true,
    });
  });
});
