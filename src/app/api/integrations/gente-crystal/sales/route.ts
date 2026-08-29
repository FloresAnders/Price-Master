import { NextResponse } from "next/server.js";
import { readUserIdFromSessionCookie } from "../../../../../lib/auth/session-cookie.server.ts";
import { getAdminDb } from "../../../../../lib/firebase-admin.ts";
import {
  createGenteCrystalSalesReader,
} from "../../../../../lib/gente-crystal/firestore-sales-reader.ts";
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
import { getControlHorarioShiftTiming } from "../../../../../utils/controlHorarioManager.ts";
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
  getShiftChangeMin: async (company, now) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

    const keys = Array.from(
      new Set(
        [company.id, company.name, company.ubicacion]
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
    const db = getAdminDb();
    const month0 = month - 1;
    const schedulesLists = await Promise.all(
      keys.map(async (key) => {
        const monthlySnap = await db
          .collection("schedules")
          .doc(`${key}_${year}_${month0}`)
          .get();
        const monthlyData = monthlySnap.exists ? monthlySnap.data() : null;
        const monthlyEntries =
          monthlyData &&
          typeof monthlyData.company === "string" &&
          typeof monthlyData.year === "number" &&
          typeof monthlyData.month === "number" &&
          monthlyData.employees &&
          typeof monthlyData.employees === "object"
            ? Object.entries(monthlyData.employees as Record<string, any>).flatMap(
                ([employeeName, days]) =>
                  Object.entries((days ?? {}) as Record<string, any>).map(
                    ([dayKey, entry]) => ({
                      companieValue: monthlyData.company,
                      employeeName,
                      year: monthlyData.year,
                      month: monthlyData.month,
                      day: Number(dayKey),
                      shift: String(entry?.shift || ""),
                      ...(typeof entry?.horasPorDia === "number"
                        ? { horasPorDia: entry.horasPorDia }
                        : {}),
                    }),
                  ),
              )
            : [];
        const legacySnap = await db
          .collection("schedules")
          .where("companieValue", "==", key)
          .where("year", "==", year)
          .where("month", "==", month0)
          .get();
        const legacyEntries = legacySnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>),
        }));
        return [...monthlyEntries, ...legacyEntries];
      }),
    );
    const timing = getControlHorarioShiftTiming({
      nowISO: now.toISOString(),
      empresa: company as any,
      monthSchedules: schedulesLists.flat() as any,
    });
    return timing.withinHorario ? timing.shiftChangeMin : null;
  },
  createReader: () => createGenteCrystalSalesReader(getAdminDb(), process.env),
});
