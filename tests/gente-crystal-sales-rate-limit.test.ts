import { describe, expect, it } from "vitest";
import { createGenteCrystalSalesPost } from "@/app/api/integrations/gente-crystal/sales/route";
import type { GenteCrystalSalesRepository } from "@/lib/gente-crystal/firestore-sales";

function makeRequest(body: unknown, token = "t".repeat(64)): Request {
  return new Request("http://localhost/api/integrations/gente-crystal/sales", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const validSale = {
  ticketId: "1234-56-78901",
  sorteo: "Loteria Nacional",
  monto: 5000,
  saleAt: "2026-09-27T10:00:00.000Z",
  captureOrigin: "indirect",
  status: "active",
};

type ConsumeLimit = (
  scope: string,
  limit: number,
  windowMs: number,
) => { allowed: boolean; retryAfterSeconds: number };

function makeDependencies(options: {
  consumeLimit: ConsumeLimit;
  createRepository?: () => GenteCrystalSalesRepository;
}) {
  const sync = async () => ({ action: "created" as const });
  return {
    now: () => new Date(),
    hashToken: (token: string) => token,
    createRepository:
      options.createRepository ?? (() => ({ sync }) as GenteCrystalSalesRepository),
    consumeLimit: options.consumeLimit,
  };
}

describe("POST /api/integrations/gente-crystal/sales — rate limit", () => {
  it("devuelve 429 con Retry-After y no toca el repositorio cuando el cupo se agota", async () => {
    let repositoryCalls = 0;
    const scopes: string[] = [];

    const dependencies = makeDependencies({
      consumeLimit: (scope) => {
        scopes.push(scope);
        return { allowed: false, retryAfterSeconds: 45 };
      },
      createRepository: () => {
        repositoryCalls += 1;
        throw new Error("el repositorio no debe invocarse con rate limit agotado");
      },
    });

    const response = await createGenteCrystalSalesPost(dependencies as any)(
      makeRequest(validSale),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe("rate_limited");
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(repositoryCalls).toBe(0);
    expect(scopes).toEqual([`gente-crystal-sales:${"t".repeat(64)}`]);
  });

  it("permite el POST y devuelve 201 cuando hay cupo disponible", async () => {
    const seenLimits: Array<{ limit: number; windowMs: number }> = [];
    const dependencies = makeDependencies({
      consumeLimit: (_scope, limit, windowMs) => {
        seenLimits.push({ limit, windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      },
    });

    const response = await createGenteCrystalSalesPost(dependencies as any)(
      makeRequest(validSale),
    );
    const body = (await response.json()) as { ok?: boolean; action?: string };

    expect(response.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.action).toBe("created");
    expect(seenLimits).toEqual([{ limit: 120, windowMs: 60_000 }]);
  });
});
