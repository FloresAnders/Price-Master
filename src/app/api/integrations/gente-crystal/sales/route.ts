import { NextResponse } from "next/server.js";
import { readUserIdFromSessionCookie } from "../../../../../lib/auth/session-cookie.server.ts";
import { getAdminDb } from "../../../../../lib/firebase-admin.ts";
import { FirestoreGenteCrystalSalesReader } from "../../../../../lib/gente-crystal/firestore-sales-reader.ts";
import {
  FirestoreGenteCrystalSalesRepository,
  type GenteCrystalSalesRepository,
} from "../../../../../lib/gente-crystal/firestore-sales.ts";
import type {
  GenteCrystalReadCompany,
  GenteCrystalReadUser,
} from "../../../../../lib/gente-crystal/read-sales.ts";
import {
  GenteCrystalSaleError,
  parseGenteCrystalSale,
  readBearerToken,
} from "../../../../../lib/gente-crystal/sales.ts";
import { hashToken } from "../../../../../lib/devices/tokens.ts";
import { createGenteCrystalSalesGet } from "./read-route.ts";

export const runtime = "nodejs";

interface GenteCrystalSalesPostDependencies {
  now: () => Date;
  hashToken: (token: string) => string;
  createRepository: () => GenteCrystalSalesRepository;
  logError?: (message: string, error: unknown) => void;
}

export function createGenteCrystalSalesPost(
  dependencies: GenteCrystalSalesPostDependencies,
) {
  return async function POST(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    try {
      const token = readBearerToken(request.headers.get("authorization"));
      const sale = parseGenteCrystalSale(body);
      const repository = dependencies.createRepository();
      const result = await repository.sync(
        dependencies.hashToken(token),
        sale,
        dependencies.now(),
      );

      return NextResponse.json(
        {
          ok: true,
          action: result.action,
          ticketId: sale.ticketId,
        },
        { status: result.action === "created" ? 201 : 200 },
      );
    } catch (error) {
      if (error instanceof GenteCrystalSaleError) {
        return NextResponse.json(
          { error: error.code },
          { status: error.status },
        );
      }

      (dependencies.logError ?? console.error)(
        "gente-crystal/sales error:",
        error,
      );
      return NextResponse.json(
        { error: "internal_server_error" },
        { status: 500 },
      );
    }
  };
}

export const POST = createGenteCrystalSalesPost({
  now: () => new Date(),
  hashToken,
  createRepository: () =>
    new FirestoreGenteCrystalSalesRepository(getAdminDb()),
});

export const GET = createGenteCrystalSalesGet({
  readUserId: readUserIdFromSessionCookie,
  getUser: async (userId) => {
    const snapshot = await getAdminDb().collection("users").doc(userId).get();
    return snapshot.exists
      ? ((snapshot.data() ?? {}) as GenteCrystalReadUser)
      : null;
  },
  getCompany: async (companyId) => {
    const snapshot = await getAdminDb()
      .collection("empresas")
      .doc(companyId)
      .get();
    return snapshot.exists
      ? ({
          ...(snapshot.data() ?? {}),
          id: snapshot.id,
        } as GenteCrystalReadCompany)
      : null;
  },
  createReader: () => new FirestoreGenteCrystalSalesReader(getAdminDb()),
});
