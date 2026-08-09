import {
  MovimientosFondosService,
  type MovementAccountKey,
} from "@/shared/services/movimientos-fondos";
import {
  DailyClosingsService,
  type DailyClosingRecord,
} from "@/shared/services/daily-closings";
import { APERTURA_FONDO_PROVIDER_CODE } from "../../constants.ts";
import type { FondoEntry } from "../../types.ts";

export const OPENING_REQUIRED_BEFORE_MOVEMENT_MESSAGE =
  "Debe registrar la apertura de fondo antes de guardar movimientos en Fondo General.";

export const OPENING_VALIDATION_FAILED_MESSAGE =
  "No se pudo validar si el fondo requiere apertura. Movimiento bloqueado.";

export const RECENT_OPENING_GUARD_PAGE_SIZE = 100;

export type FondoGeneralOpeningValidationResult =
  | {
      allowed: true;
      latestMovement?: FondoEntry | null;
      latestClosing?: DailyClosingRecord | null;
    }
  | {
      allowed: false;
      reason: "opening_required" | "validation_failed";
      message: string;
      latestMovement?: FondoEntry | null;
      latestClosing?: DailyClosingRecord | null;
    };

export function isOpeningRequiredForLatestMovement(
  latestMovement: Partial<FondoEntry> | null | undefined,
  solicitarApertura: boolean,
): boolean {
  if (!solicitarApertura) return false;
  return (
    latestMovement?.requiresOpening === true &&
    latestMovement?.accountId === "FondoGeneral"
  );
}

function normalizeProviderCode(providerCode: unknown): string {
  return String(providerCode || "")
    .trim()
    .toUpperCase();
}

function parseTimeMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getClosingTimeMs(
  closing: Partial<DailyClosingRecord> | null | undefined,
): number | null {
  return parseTimeMs(closing?.createdAt) ?? parseTimeMs(closing?.closingDate);
}

function getMovementTimeMs(
  movement: Partial<FondoEntry> | null | undefined,
): number | null {
  return parseTimeMs(movement?.createdAt) ?? parseTimeMs(movement?.updateAt);
}

function isCashOpeningMovement(movement: Partial<FondoEntry>): boolean {
  return (
    movement.accountId === "FondoGeneral" &&
    normalizeProviderCode(movement.providerCode) === APERTURA_FONDO_PROVIDER_CODE
  );
}

export function isOpeningRequiredInRecentMovements(
  movements: Array<Partial<FondoEntry>> | null | undefined,
  solicitarApertura: boolean,
): boolean {
  if (!solicitarApertura) return false;

  for (const movement of movements ?? []) {
    if (movement?.accountId !== "FondoGeneral") continue;

    if (isCashOpeningMovement(movement)) {
      return false;
    }

    if (movement.requiresOpening === true) {
      return true;
    }
  }

  return false;
}

export function isOpeningRequiredAfterLatestClosing(
  movementsSinceClosing: Array<Partial<FondoEntry>> | null | undefined,
  latestClosing: Partial<DailyClosingRecord> | null | undefined,
  solicitarApertura: boolean,
): boolean {
  if (!solicitarApertura || !latestClosing) return false;

  const latestClosingMs = getClosingTimeMs(latestClosing);
  if (latestClosingMs === null) return false;

  for (const movement of movementsSinceClosing ?? []) {
    if (movement?.accountId !== "FondoGeneral") continue;
    const movementMs = getMovementTimeMs(movement);
    if (movementMs !== null && movementMs < latestClosingMs) continue;
    if (isCashOpeningMovement(movement)) return false;
  }

  return true;
}

export async function fetchLatestFondoGeneralMovement(
  company: string,
): Promise<FondoEntry | null> {
  const normalizedCompany = String(company || "").trim();
  if (!normalizedCompany) return null;

  const docId =
    MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
  if (!docId) return null;

  const result = await MovimientosFondosService.listMovementsPage<FondoEntry>(
    docId,
    {
      pageSize: 1,
      accountId: "FondoGeneral",
    },
  );

  return result.items[0] ?? null;
}

export async function fetchRecentFondoGeneralMovements(
  company: string,
): Promise<FondoEntry[]> {
  const normalizedCompany = String(company || "").trim();
  if (!normalizedCompany) return [];

  const docId =
    MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
  if (!docId) return [];

  const result = await MovimientosFondosService.listMovementsPage<FondoEntry>(
    docId,
    {
      pageSize: RECENT_OPENING_GUARD_PAGE_SIZE,
      accountId: "FondoGeneral",
    },
  );

  return result.items;
}

export async function fetchLatestFondoGeneralClosing(
  company: string,
): Promise<DailyClosingRecord | null> {
  const normalizedCompany = String(company || "").trim();
  if (!normalizedCompany) return null;

  const document = await DailyClosingsService.getDocument(normalizedCompany);
  return document ? DailyClosingsService.extractAllClosings(document)[0] ?? null : null;
}

export async function fetchFondoGeneralMovementsAfter(
  company: string,
  startIso: string,
): Promise<FondoEntry[]> {
  const normalizedCompany = String(company || "").trim();
  const normalizedStart = String(startIso || "").trim();
  if (!normalizedCompany || !normalizedStart) return [];

  const docId =
    MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
  if (!docId) return [];

  const out: FondoEntry[] = [];
  let cursor: any = null;

  for (let page = 0; page < 20; page += 1) {
    const result =
      await MovimientosFondosService.listMovementsPageByCreatedAtRange<FondoEntry>(
        docId,
        {
          startIso: normalizedStart,
          endIsoExclusive: "9999-12-31T23:59:59.999Z",
          pageSize: RECENT_OPENING_GUARD_PAGE_SIZE,
          cursor,
          accountId: "FondoGeneral",
        },
      );

    out.push(...result.items);
    if (result.exhausted) break;
    cursor = result.cursor;
    if (!cursor) break;
  }

  return out;
}

export async function validateFondoGeneralOpeningRequirement(args: {
  company: string | null | undefined;
  accountKey: MovementAccountKey | string;
  solicitarApertura?: boolean;
  loadLatestMovement?: () => Promise<FondoEntry | null>;
  loadRecentMovements?: () => Promise<FondoEntry[]>;
  loadLatestClosing?: () => Promise<DailyClosingRecord | null>;
  loadMovementsAfterLatestClosing?: (
    latestClosing: DailyClosingRecord,
  ) => Promise<FondoEntry[]>;
}): Promise<FondoGeneralOpeningValidationResult> {
  if (args.accountKey !== "FondoGeneral") {
    return { allowed: true };
  }

  const solicitarApertura = args.solicitarApertura !== false;
  if (!solicitarApertura) {
    return { allowed: true };
  }

  const normalizedCompany = String(args.company || "").trim();
  if (!normalizedCompany) {
    return {
      allowed: false,
      reason: "validation_failed",
      message: OPENING_VALIDATION_FAILED_MESSAGE,
    };
  }

  try {
    const latestClosing = args.loadLatestClosing
      ? await args.loadLatestClosing()
      : await fetchLatestFondoGeneralClosing(normalizedCompany);

    if (latestClosing) {
      const closingStartIso =
        latestClosing.createdAt || latestClosing.closingDate || "";
      const movementsSinceClosing = args.loadMovementsAfterLatestClosing
        ? await args.loadMovementsAfterLatestClosing(latestClosing)
        : await fetchFondoGeneralMovementsAfter(
            normalizedCompany,
            closingStartIso,
          );
      const latestMovement = movementsSinceClosing[0] ?? null;

      if (
        isOpeningRequiredAfterLatestClosing(
          movementsSinceClosing,
          latestClosing,
          solicitarApertura,
        )
      ) {
        return {
          allowed: false,
          reason: "opening_required",
          message: OPENING_REQUIRED_BEFORE_MOVEMENT_MESSAGE,
          latestMovement,
          latestClosing,
        };
      }

      return { allowed: true, latestMovement, latestClosing };
    }

    let recentMovements: FondoEntry[];
    if (args.loadRecentMovements) {
      recentMovements = await args.loadRecentMovements();
    } else if (args.loadLatestMovement) {
      const latestMovement = await args.loadLatestMovement();
      recentMovements = latestMovement ? [latestMovement] : [];
    } else {
      recentMovements = await fetchRecentFondoGeneralMovements(
        normalizedCompany,
      );
    }

    const latestMovement = recentMovements[0] ?? null;
    if (isOpeningRequiredInRecentMovements(recentMovements, solicitarApertura)) {
      return {
        allowed: false,
        reason: "opening_required",
        message: OPENING_REQUIRED_BEFORE_MOVEMENT_MESSAGE,
        latestMovement,
      };
    }

    return { allowed: true, latestMovement };
  } catch (err) {
    console.error("[OPENING-GUARD] Error validating opening requirement:", err);
    return {
      allowed: false,
      reason: "validation_failed",
      message: OPENING_VALIDATION_FAILED_MESSAGE,
    };
  }
}
