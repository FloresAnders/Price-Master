import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const workerPath = resolve(process.cwd(), "public/sw.js");

type WorkerListener = (event: Record<string, unknown>) => void;

function request(
  pathname: string,
  options: {
    method?: string;
    mode?: string;
    destination?: string;
    origin?: string;
  } = {},
) {
  const origin = options.origin ?? "https://timemaster.test";
  return {
    url: new URL(pathname, origin).toString(),
    method: options.method ?? "GET",
    mode: options.mode ?? "cors",
    destination: options.destination ?? "",
  };
}

function createHarness() {
  expect(existsSync(workerPath), "public/sw.js must exist").toBe(true);
  const source = readFileSync(workerPath, "utf8");
  const listeners = new Map<string, WorkerListener>();
  const stores = new Map<string, Map<string, Response>>();
  const added = new Map<string, string[]>();

  const keyFor = (value: string | { url: string }) =>
    typeof value === "string" ? value : value.url;

  const caches = {
    async open(name: string) {
      let store = stores.get(name);
      if (!store) {
        store = new Map();
        stores.set(name, store);
      }

      return {
        async addAll(urls: string[]) {
          added.set(name, [...urls]);
          for (const url of urls) {
            store?.set(url, new Response(`precache:${url}`, { status: 200 }));
          }
        },
        async match(value: string | { url: string }) {
          return store?.get(keyFor(value));
        },
        async put(value: string | { url: string }, response: Response) {
          store?.set(keyFor(value), response);
        },
      };
    },
    async match(value: string | { url: string }) {
      const key = keyFor(value);
      for (const store of stores.values()) {
        const match = store.get(key);
        if (match) return match;
      }
      return undefined;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };

  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const claim = vi.fn().mockResolvedValue(undefined);
  const fetchMock = vi.fn(async () => new Response("network", { status: 200 }));
  const self = {
    location: new URL("https://timemaster.test/"),
    addEventListener(type: string, listener: WorkerListener) {
      listeners.set(type, listener);
    },
    skipWaiting,
    clients: { claim },
  };

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchMock,
    URL,
    Response,
    console,
  });

  async function dispatchExtendable(type: "install" | "activate") {
    let pending: Promise<unknown> | undefined;
    listeners.get(type)?.({
      waitUntil(value: Promise<unknown>) {
        pending = value;
      },
    });
    await pending;
  }

  async function dispatchFetch(workerRequest: ReturnType<typeof request>) {
    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: workerRequest,
      respondWith(value: Promise<Response>) {
        responsePromise = value;
      },
    });
    return responsePromise;
  }

  return {
    added,
    caches,
    claim,
    dispatchExtendable,
    dispatchFetch,
    fetchMock,
    skipWaiting,
    stores,
  };
}

describe("Time Master service worker", () => {
  it("precaches only the public offline shell during install", async () => {
    const harness = createHarness();

    await harness.dispatchExtendable("install");

    expect([...harness.added.values()]).toEqual([
      [
        "/offline.html",
        "/android-chrome-192x192.png",
        "/android-chrome-512x512.png",
        "/apple-touch-icon.png",
      ],
    ]);
    expect(harness.skipWaiting).toHaveBeenCalledOnce();
  });

  it("deletes old Time Master caches but preserves caches owned by other apps", async () => {
    const harness = createHarness();
    await harness.dispatchExtendable("install");
    await harness.caches.open("timemaster-static-old");
    await harness.caches.open("other-app-cache");

    await harness.dispatchExtendable("activate");

    expect(await harness.caches.keys()).toEqual([
      "timemaster-static-v1",
      "other-app-cache",
    ]);
    expect(harness.claim).toHaveBeenCalledOnce();
  });

  it.each([
    ["cross-origin", request("/logo.png", { origin: "https://cdn.test", destination: "image" })],
    ["API", request("/api/accounts", { destination: "image" })],
    ["non-GET", request("/upload", { method: "POST", destination: "image" })],
    ["same-origin data", request("/dashboard-data")],
  ])("bypasses %s requests", async (_label, workerRequest) => {
    const harness = createHarness();

    const response = await harness.dispatchFetch(workerRequest);

    expect(response).toBeUndefined();
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("uses the static offline page when a navigation request fails", async () => {
    const harness = createHarness();
    await harness.dispatchExtendable("install");
    harness.fetchMock.mockRejectedValueOnce(new Error("offline"));

    const response = await harness.dispatchFetch(
      request("/fondogeneral", { mode: "navigate" }),
    );

    expect(response).toMatchObject({ status: 200 });
    expect(await response?.text()).toBe("precache:/offline.html");
  });

  it("serves same-origin static assets cache-first", async () => {
    const harness = createHarness();
    const cache = await harness.caches.open("timemaster-static-v1");
    const assetRequest = request("/_next/static/app.js", {
      destination: "script",
    });
    await cache.put(assetRequest, new Response("cached-script", { status: 200 }));

    const response = await harness.dispatchFetch(assetRequest);

    expect(await (await response)?.text()).toBe("cached-script");
    expect(harness.fetchMock).not.toHaveBeenCalled();
  });

  it("stores successful same-origin static responses for later offline use", async () => {
    const harness = createHarness();
    const assetRequest = request("/favicon-32x32.png", {
      destination: "image",
    });
    harness.fetchMock.mockResolvedValueOnce(
      new Response("fresh-image", { status: 200 }),
    );

    const response = await harness.dispatchFetch(assetRequest);

    expect(await (await response)?.text()).toBe("fresh-image");
    const cached = await harness.caches.match(assetRequest);
    expect(await cached?.text()).toBe("fresh-image");
  });
});
