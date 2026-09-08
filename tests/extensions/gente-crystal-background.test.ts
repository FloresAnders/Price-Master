import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const syncCore = require(
  "../../extensions/TimemasterGentecrystal/sync-core.js",
);

const QUEUE_KEY = "genteCrystalSyncQueue";
const CONFIG_KEY = "genteCrystalIntegrationConfig";

async function waitFor(condition: () => boolean, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("Gente Crystal background queue", () => {
  test("re-reads the queue so a new local pair overtakes the remaining history", async () => {
    const queue = syncCore.enqueueEvents(
      {},
      [
        {
          ticketId: "42662-2204-59897000",
          sorteo: "Nica 11:00 Am",
          monto: 500,
          saleAt: "2026-09-08T16:30:00.000Z",
          captureOrigin: "indirect",
          status: "active",
        },
        {
          ticketId: "42662-2204-59897001",
          sorteo: "Nica 11:00 Am",
          monto: 600,
          saleAt: "2026-09-08T16:31:00.000Z",
          captureOrigin: "indirect",
          status: "active",
        },
      ],
      1000,
    );
    const storage: Record<string, unknown> = {
      [QUEUE_KEY]: queue,
      [CONFIG_KEY]: {
        apiBaseUrl: "https://www.timemaster.es",
        token: "device-token",
      },
    };
    let runtimeListener: (
      message: unknown,
      sender: unknown,
      sendResponse: (response: unknown) => void,
    ) => boolean = () => false;
    let notifyFirstFetchStarted!: () => void;
    let releaseFirstFetch!: () => void;
    const firstFetchStarted = new Promise<void>((resolve) => {
      notifyFirstFetchStarted = resolve;
    });
    const firstFetchGate = new Promise<void>((resolve) => {
      releaseFirstFetch = resolve;
    });
    const sentTickets: string[] = [];
    const sandbox: Record<string, unknown> = {};

    Object.assign(sandbox, {
      console,
      setTimeout,
      clearTimeout,
      importScripts: () => {
        sandbox.TimeMasterGenteCrystalSync = syncCore;
      },
      fetch: async (_url: string, options: { body: string }) => {
        const payload = JSON.parse(options.body) as { ticketId: string };
        sentTickets.push(payload.ticketId);
        if (sentTickets.length === 1) {
          notifyFirstFetchStarted();
          await firstFetchGate;
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ ok: true }),
        };
      },
      chrome: {
        storage: {
          local: {
            get: async (keys: string | string[]) => {
              const wanted = Array.isArray(keys) ? keys : [keys];
              return Object.fromEntries(
                wanted.map((key) => [key, storage[key]]),
              );
            },
            set: async (values: Record<string, unknown>) => {
              Object.assign(storage, values);
            },
          },
        },
        alarms: {
          create: () => undefined,
          onAlarm: { addListener: () => undefined },
        },
        runtime: {
          onInstalled: { addListener: () => undefined },
          onStartup: { addListener: () => undefined },
          onMessage: {
            addListener: (listener: typeof runtimeListener) => {
              runtimeListener = listener;
            },
          },
        },
      },
    });

    const source = readFileSync(
      new URL(
        "../../extensions/TimemasterGentecrystal/background.js",
        import.meta.url,
      ),
      "utf8",
    );
    runInNewContext(source, sandbox);
    await firstFetchStarted;

    const enqueueThroughWorker = (events: Record<string, unknown>[]) =>
      new Promise<void>((resolve) => {
        runtimeListener(
          { type: "TM_GC_QUEUE_SALES", events },
          null,
          () => resolve(),
        );
      });
    await enqueueThroughWorker([
      {
        ticketId: "42661-2204-59898072",
        sorteo: "Nica Especial 11:00 Am",
        monto: 50,
        saleAt: "2026-09-08T16:34:53.755Z",
        captureOrigin: "local_button",
        status: "active",
      },
    ]);
    await enqueueThroughWorker([
      {
        ticketId: "42662-2204-59898071",
        sorteo: "Nica 11:00 Am",
        monto: 50,
        saleAt: "2026-09-08T16:34:53.755Z",
        captureOrigin: "local_button",
        status: "active",
      },
    ]);
    releaseFirstFetch();
    await waitFor(() => sentTickets.length === 4);

    expect(sentTickets).toEqual([
      "42662-2204-59897000",
      "42662-2204-59898071",
      "42661-2204-59898072",
      "42662-2204-59897001",
    ]);
  });
});
