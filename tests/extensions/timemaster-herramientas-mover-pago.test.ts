// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-require-imports -- Extension module exposes a CommonJS test API. */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const extensionDir = path.resolve("extensions/TimeMasterHerramientas");
const moverPago = require(path.join(extensionDir, "moverpago-core.js"));

describe("movimiento entre medios de pago en Contica", () => {
  test("reconoce E, T y S en la interfaz actual proporcionada", () => {
    const html = fs.readFileSync(path.resolve("data/newForma.md"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.documentElement.innerHTML = parsed.documentElement.innerHTML;

    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const card = document.getElementById("pay-card") as HTMLInputElement;
    const cardVoucher = document.getElementById(
      "pay-card-voucher",
    ) as HTMLInputElement;
    const sinpe = document.getElementById("pay-sinpe") as HTMLInputElement;
    const controller = moverPago.createPaymentShortcutController(document);
    controller.start();

    cash.value = "5000";
    cardVoucher.value = "ABC-123";
    cash.dispatchEvent(new KeyboardEvent("keydown", { key: "T", bubbles: true }));
    expect(cash.value).toBe("");
    expect(card.value).toBe("5000");
    expect(cardVoucher.value).toBe("ABC-123");
    expect(document.activeElement).toBe(card);

    card.dispatchEvent(new KeyboardEvent("keydown", { key: "S", bubbles: true }));
    expect(card.value).toBe("");
    expect(sinpe.value).toBe("5000");
    expect(document.activeElement).toBe(sinpe);

    sinpe.dispatchEvent(new KeyboardEvent("keydown", { key: "E", bubbles: true }));
    expect(sinpe.value).toBe("");
    expect(cash.value).toBe("5000");
    expect(document.activeElement).toBe(cash);

    controller.stop();
  });
});
