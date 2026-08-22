import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it, vi } from "vitest";

async function captureQueuedEventFromPrintText(ticketText: string) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "extensions", "print-confirmation.js"),
    "utf8",
  );
  const queuedEvents: Array<Record<string, unknown>> = [];
  const storage = new Map<string, unknown>();
  let messageListener:
    | ((
        message: Record<string, unknown>,
        sender: unknown,
        sendResponse: (response: unknown) => void,
      ) => boolean | undefined)
    | null = null;

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    document: {
      body: {
        innerText: ticketText,
        textContent: ticketText,
      },
      documentElement: {
        innerText: ticketText,
        textContent: ticketText,
      },
    },
    window: {
      location: {
        pathname: "/print_pagos.php",
        search: "?ticket=42085-2204-59417340",
        hash: "",
      },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          }),
        },
        sendMessage: vi.fn(async (message) => {
          if (message?.type === "TM_GC_QUEUE_SALES") {
            queuedEvents.push(...message.events);
          }
          return { ok: true };
        }),
      },
      storage: {
        local: {
          get: vi.fn(async (keys) => {
            const response: Record<string, unknown> = {};
            for (const key of Array.isArray(keys) ? keys : [keys]) {
              response[key] = storage.get(key);
            }
            return response;
          }),
          set: vi.fn(async (values) => {
            for (const [key, value] of Object.entries(values)) {
              storage.set(key, value);
            }
          }),
        },
      },
    },
    TimeMasterGenteCrystalSync: {
      appendConfirmedLocalTicket: (
        markers: unknown,
        ticketId: string,
        now: number,
      ) => [
        ...((Array.isArray(markers) ? markers : []) as Array<unknown>),
        { ticketId, confirmedAt: now },
      ],
      buildActivePayload: (sale: Record<string, unknown>) => sale,
      extractPrintedTicketId: (value: string) =>
        String(value).match(/\b\d{4,}-\d{2,6}-\d{5,}\b/)?.[0] || null,
      isExtensionContextInvalidatedError: () => false,
      parseObservedSaleDateTime: () => ({
        fecha: "21/08/2026",
        hora: "21:22:54",
        timestamp: new Date(2026, 7, 21, 21, 22, 54).getTime(),
        timestampPrecisionMs: 1000,
      }),
    },
  });

  vm.runInContext(source, context);
  expect(messageListener).toBeTypeOf("function");

  const response = await new Promise<Record<string, unknown>>((resolve) => {
    messageListener?.({ type: "TM_FORCE_SCAN" }, null, (value) =>
      resolve(value as Record<string, unknown>),
    );
  });

  expect(response.ok).toBe(true);
  return queuedEvents.at(-1);
}

describe("Gente Crystal print confirmation", () => {
  it("usa el nombre del sorteo de la linea posterior a Fecha sorteo", async () => {
    const ticketText = [
      "Grupo Cafetero",
      "42085-2204-59417340",
      "21/08/2026 21:22:54",
      "EE115E26",
      "Puesto: Tiempos Delikor Palmares",
      "Fecha sorteo: 22/08/2026",
      "LA PRIMERA DIA",
      "Cliente: Anonimo",
      "=========================",
      "Numero -> Monto",
      "00 -> 100",
      "Total: 100",
      "=========================",
    ].join("\n");

    await expect(captureQueuedEventFromPrintText(ticketText)).resolves.toMatchObject({
      ticketId: "42085-2204-59417340",
      sorteo: "LA PRIMERA DIA",
      monto: 100,
      captureOrigin: "local_button",
    });
  });

  it("usa el nombre del sorteo cuando fecha y sorteo vienen juntos antes de Cliente", async () => {
    const ticketText = [
      "Grupo Cafetero",
      "42085-2204-59417340",
      "21/08/2026 21:22:54",
      "EE115E26",
      "Puesto: Tiempos Delikor Palmares",
      "Fecha sorteo:",
      "22/08/2026 LA PRIMERA DIA",
      "Cliente: Anonimo",
      "=========================",
      "Numero -> Monto",
      "00 -> 100",
      "Total: 100",
      "=========================",
    ].join("\n");

    await expect(captureQueuedEventFromPrintText(ticketText)).resolves.toMatchObject({
      ticketId: "42085-2204-59417340",
      sorteo: "LA PRIMERA DIA",
      monto: 100,
      captureOrigin: "local_button",
    });
  });
});
