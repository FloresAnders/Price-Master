const CACHE_PREFIX = "timemaster-";
const STATIC_CACHE = `${CACHE_PREFIX}static-v2`;
const OFFLINE_URL = "/offline.html";
const APP_SHELL_URL = "/";
const PRECACHE_URLS = [
  OFFLINE_URL,
  APP_SHELL_URL,
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
];
const PUBLIC_ASSET_PATHS = new Set([
  ...PRECACHE_URLS,
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon.ico",
  "/site.webmanifest",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName.startsWith(CACHE_PREFIX) &&
              cacheName !== STATIC_CACHE,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

function isCacheableStaticRequest(request, url) {
  if (!new Set(["script", "style", "font", "image"]).has(request.destination)) {
    return false;
  }

  return (
    url.pathname.startsWith("/_next/static/") ||
    PUBLIC_ASSET_PATHS.has(url.pathname)
  );
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(APP_SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const appShell = await caches.match(APP_SHELL_URL);
    if (appShell) return appShell;
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableStaticRequest(request, url)) {
    event.respondWith(cacheFirstStatic(request));
  }
});
