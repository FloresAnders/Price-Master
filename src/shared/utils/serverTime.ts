let cachedServerTime: Date | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

function cacheClockMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

async function fromTimeApi(): Promise<Date | null> {
  const data = await fetchJson<{ dateTime: string }>(
    "https://timeapi.io/api/Time/current/zone?timeZone=America/Costa_Rica",
    5000,
  );
  if (!data?.dateTime) return null;
  const d = new Date(data.dateTime);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fromAppServer(): Promise<Date | null> {
  if (typeof window === "undefined") return null;
  const data = await fetchJson<{ now?: string; ms?: number }>("/api/server-time", 5000);
  const raw = data?.now ?? (typeof data?.ms === "number" ? data.ms : null);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getAuthoritativeNow(): Promise<Date> {
  const now = cacheClockMs();
  if (cachedServerTime && now - cachedAt < CACHE_TTL_MS) {
    return new Date(cachedServerTime.getTime() + Math.max(0, now - cachedAt));
  }

  const apiDate = await fromAppServer() ?? await fromTimeApi();
  if (apiDate) {
    cachedServerTime = apiDate;
    cachedAt = cacheClockMs();
    return new Date(apiDate.getTime());
  }

  throw new Error("No se pudo validar la hora del servidor");
}

export async function getAuthoritativeNowISO(): Promise<string> {
  const d = await getAuthoritativeNow();
  return d.toISOString();
}

export async function getAuthoritativeNowMs(): Promise<number> {
  const d = await getAuthoritativeNow();
  return d.getTime();
}
