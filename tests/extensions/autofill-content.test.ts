/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPasswordRecord,
} from "../../extensions/ProteccionAutorrelleno/autofill-core.js";
import "../../extensions/ProteccionAutorrelleno/content-gate.js";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("autofill protection content", () => {
  it("desbloquea con un control enmascarado que no solicita credenciales guardadas", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <form>
        <input type="email" autocomplete="username">
        <input type="password" autocomplete="current-password">
      </form>
    `;

    const settings = {
      enabled: true,
      protectedUrls: [location.href],
      passwordRecord: await createPasswordRecord("clave-segura"),
    };
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get(key: string, callback: (value: object) => void) {
            callback({ [key]: settings });
          },
        },
        onChanged: { addListener() {} },
      },
    });

    let overlayShadow: ShadowRoot | null = null;
    const attachShadow = Element.prototype.attachShadow;
    vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (
      this: Element,
      init: ShadowRootInit,
    ) {
      overlayShadow = attachShadow.call(this, { ...init, mode: "open" });
      return overlayShadow;
    });

    await import("../../extensions/ProteccionAutorrelleno/content.js");
    await vi.advanceTimersByTimeAsync(1);

    const input = overlayShadow?.querySelector<HTMLInputElement>("#password");
    expect(input).toBeTruthy();
    expect(input?.type).toBe("text");
    expect(input?.autocomplete).toBe("one-time-code");

    input?.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data: "clave-segura",
        inputType: "insertText",
      }),
    );
    input?.form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() => {
      expect(document.getElementById("proteccion-autorrelleno-overlay")).toBeNull();
    });
  });
});
