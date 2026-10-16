import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { canAccessSinpeEmpresa } from "@/services/sinpe-access.server";
import type { Empresas, User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";
import type {
  ReporteMovimientoClassification,
  ReporteMovimientoCurrency,
  ReporteMovimientosDetailItem,
  ReportDetailLimit,
} from "@/services/reportes-movimientos";

const REPORT_ACCOUNTS = [
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
  "CajaNegra",
  "Tucan",
  "Tiempos",
] as const;

type ReportAccountId = (typeof REPORT_ACCOUNTS)[number];

export type ReportDetailRequest = {
  fromIso: string;
  toExclusiveIso: string;
  empresa?: string;
  empresas?: string[];
  accountIds: string[];
  currency: ReporteMovimientoCurrency;
  classification?: ReporteMovimientoClassification;
  paymentType?: string;
  limit?: ReportDetailLimit;
};

type ReportDetailDependencies = {
  listCompanies: () => Promise<Empresas[]>;
  queryItems: (
    request: ReportDetailRequest,
  ) => Promise<ReporteMovimientosDetailItem[]>;
};

export class ReportDetailAccessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = "ReportDetailAccessError";
  }
}

const normalizeKey = (value: unknown) => String(value ?? "").trim().toLowerCase();

export function isReportDetailItemPath(path: string): boolean {
  const segments = String(path || "").split("/");
  return (
    segments.length === 4 &&
    segments[0] === "reportes_detalle" &&
    Boolean(segments[1]) &&
    segments[2] === "items" &&
    Boolean(segments[3])
  );
}

const stringList = (value: unknown, maximum: number): string[] => {
  if (!Array.isArray(value)) {
    throw new ReportDetailAccessError(400, "invalid_request");
  }
  const normalized = Array.from(
    new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean)),
  );
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new ReportDetailAccessError(400, "invalid_request");
  }
  return normalized;
};

export function parseReportDetailRequest(raw: unknown): ReportDetailRequest {
  if (!raw || typeof raw !== "object") {
    throw new ReportDetailAccessError(400, "invalid_request");
  }
  const input = raw as Record<string, unknown>;
  const fromIso = String(input.fromIso ?? "").trim();
  const toExclusiveIso = String(input.toExclusiveIso ?? "").trim();
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toExclusiveIso);
  if (
    !fromIso ||
    !toExclusiveIso ||
    !Number.isFinite(fromMs) ||
    !Number.isFinite(toMs) ||
    fromMs >= toMs ||
    toMs - fromMs > 370 * 24 * 60 * 60 * 1000
  ) {
    throw new ReportDetailAccessError(400, "invalid_date_range");
  }

  const singleCompany = String(input.empresa ?? "").trim();
  const empresas = singleCompany
    ? [singleCompany]
    : stringList(input.empresas, 30);
  const accountIds = stringList(input.accountIds, 10);
  const currency = input.currency === "USD" ? "USD" : input.currency === "CRC" ? "CRC" : null;
  if (!currency) throw new ReportDetailAccessError(400, "invalid_currency");

  const rawClassification = String(input.classification ?? "").trim();
  const classification = rawClassification
    ? (["ingreso", "gasto", "egreso"].includes(rawClassification)
        ? (rawClassification as ReporteMovimientoClassification)
        : null)
    : undefined;
  if (classification === null) {
    throw new ReportDetailAccessError(400, "invalid_classification");
  }

  const rawLimit = input.limit ?? 50;
  const limit = rawLimit === "all"
    ? "all"
    : typeof rawLimit === "number" && [25, 50, 75, 100].includes(rawLimit)
      ? (rawLimit as ReportDetailLimit)
      : null;
  if (limit === null) throw new ReportDetailAccessError(400, "invalid_limit");

  const paymentType = String(input.paymentType ?? "").trim();
  return {
    fromIso,
    toExclusiveIso,
    empresas,
    accountIds,
    currency,
    ...(classification ? { classification } : {}),
    ...(paymentType ? { paymentType } : {}),
    limit,
  };
}

function allowedAccountsFor(user: Omit<User, "password">): Set<ReportAccountId> {
  const permissions = normalizeUserPermissions(
    user.permissions,
    user.role || "user",
  );
  const allowed = new Set<ReportAccountId>();
  if (permissions.fondogeneral) allowed.add("FondoGeneral");
  if (permissions.fondogeneralBCR) allowed.add("BCR");
  if (permissions.fondogeneralBN) allowed.add("BN");
  if (permissions.fondogeneralBAC) allowed.add("BAC");
  if (permissions.cajaNegra) allowed.add("CajaNegra");
  if (permissions.tucan) allowed.add("Tucan");
  if (permissions.tiempos) allowed.add("Tiempos");
  return allowed;
}

async function listReportCompanies(): Promise<Empresas[]> {
  const snapshot = await getAdminDb().collection("empresas").get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  })) as Empresas[];
}

export async function queryReportDetailItems(
  request: ReportDetailRequest,
): Promise<ReporteMovimientosDetailItem[]> {
  let detailQuery: Query<DocumentData> = getAdminDb()
    .collectionGroup("items")
    .where("createdAt", ">=", request.fromIso)
    .where("createdAt", "<", request.toExclusiveIso)
    .where("currency", "==", request.currency);

  const empresas = request.empresas || (request.empresa ? [request.empresa] : []);
  detailQuery = empresas.length === 1
    ? detailQuery.where("empresa", "==", empresas[0])
    : detailQuery.where("empresa", "in", empresas);
  detailQuery = request.accountIds.length === 1
    ? detailQuery.where("accountId", "==", request.accountIds[0])
    : detailQuery.where("accountId", "in", request.accountIds);

  if (request.classification) {
    detailQuery = detailQuery.where("classification", "==", request.classification);
  }
  if (request.paymentType) {
    detailQuery = detailQuery.where("paymentType", "==", request.paymentType);
  }
  detailQuery = detailQuery.orderBy("createdAt", "asc");

  const selectedLimit = request.limit ?? 50;
  const requestedCount = selectedLimit === "all" ? Infinity : selectedLimit;
  const pageSize = 100;
  const results: ReporteMovimientosDetailItem[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  do {
    const pageQuery: Query<DocumentData> = cursor
      ? detailQuery.startAfter(cursor).limit(pageSize)
      : detailQuery.limit(pageSize);
    const snapshot = await pageQuery.get();
    results.push(
      ...snapshot.docs
        .filter((document) => isReportDetailItemPath(document.ref.path))
        .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          movementId: String(data.movementId || document.id),
          empresa: String(data.empresa || ""),
          createdAt: String(data.createdAt || ""),
          accountId: String(data.accountId || ""),
          manager: String(data.manager || ""),
          paymentType: String(data.paymentType || ""),
          classification: ["ingreso", "gasto", "egreso"].includes(data.classification)
            ? data.classification
            : "egreso",
          amountIngreso: Math.trunc(Number(data.amountIngreso ?? 0)) || 0,
          amountEgreso: Math.trunc(Number(data.amountEgreso ?? 0)) || 0,
          currency: data.currency === "USD" ? "USD" : "CRC",
          invoiceNumber: String(data.invoiceNumber || ""),
          providerCode: String(data.providerCode || ""),
          notes: String(data.notes || ""),
          } as ReporteMovimientosDetailItem;
        }),
    );
    cursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
    if (results.length >= requestedCount || snapshot.size < pageSize) break;
  } while (cursor);

  return selectedLimit === "all" ? results : results.slice(0, selectedLimit);
}

const defaultDependencies: ReportDetailDependencies = {
  listCompanies: listReportCompanies,
  queryItems: queryReportDetailItems,
};

export async function getAuthorizedReportDetailItems(
  user: Omit<User, "password">,
  rawRequest: unknown,
  dependencies: ReportDetailDependencies = defaultDependencies,
): Promise<ReporteMovimientosDetailItem[]> {
  const permissions = normalizeUserPermissions(
    user.permissions,
    user.role || "user",
  );
  if (permissions.fondogeneral !== true) {
    throw new ReportDetailAccessError(403, "forbidden");
  }

  const request = parseReportDetailRequest(rawRequest);
  const allowedAccounts = allowedAccountsFor(user);
  if (
    request.accountIds.some(
      (accountId) =>
        !REPORT_ACCOUNTS.includes(accountId as ReportAccountId) ||
        !allowedAccounts.has(accountId as ReportAccountId),
    )
  ) {
    throw new ReportDetailAccessError(403, "forbidden_account");
  }

  if (user.role !== "superadmin") {
    const companies = await dependencies.listCompanies();
    const requestedCompanies = request.empresas || [];
    const allAllowed = requestedCompanies.every((requested) => {
      const key = normalizeKey(requested);
      const company = companies.find((candidate) =>
        [candidate.id, candidate.name, candidate.ubicacion]
          .map(normalizeKey)
          .filter(Boolean)
          .includes(key),
      );
      return Boolean(company && canAccessSinpeEmpresa(user, company));
    });
    if (!allAllowed) {
      throw new ReportDetailAccessError(403, "forbidden_company");
    }
  }

  return dependencies.queryItems(request);
}

