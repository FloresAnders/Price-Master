import {
  collection,
  collectionGroup,
  getDocs,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/config/firebase";

export type ReporteMovimientoClassification = "ingreso" | "gasto" | "egreso";
export type ReporteMovimientoCurrency = "CRC" | "USD";

export type ReporteMovimientosDailyDoc = {
  id: string;
  date: string; // YYYY-MM-DD
  year: number;
  month: number;
  empresa: string;
  accountId: string;
  count?: number;
  totalIngreso?: number;
  totalGasto?: number;
  totalEgreso?: number;
  lastMovementAt?: string;
  updatedAt?: unknown;
  byType?: Record<
    string,
    Record<
      ReporteMovimientoCurrency,
      {
        count?: number;
        ingreso?: number;
        gasto?: number;
        egreso?: number;
      }
    >
  >;
};

export type ReporteMovimientosDetailItem = {
  id: string;
  movementId: string;
  empresa: string;
  createdAt: string;
  accountId: string;
  manager?: string;
  paymentType: string;
  classification: ReporteMovimientoClassification;
  amountIngreso: number;
  amountEgreso: number;
  currency: ReporteMovimientoCurrency;
  invoiceNumber?: string;
  providerCode?: string;
  notes?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

type ByTypeBucket = {
  count?: number;
  ingreso?: number;
  gasto?: number;
  egreso?: number;
};

type ByTypeMap = Record<string, Record<ReporteMovimientoCurrency, ByTypeBucket>>;

const extractByTypeFromFlattenedKeys = (data: Record<string, unknown>): ByTypeMap => {
  const out: ByTypeMap = {};

  Object.entries(data).forEach(([key, value]) => {
    if (!key.startsWith("byType.")) return;
    const match = /^byType\.(.+)\.(CRC|USD)\.(count|ingreso|gasto|egreso)$/.exec(key);
    if (!match) return;

    let typeKey = match[1];
    if (typeKey.startsWith("`") && typeKey.endsWith("`")) {
      typeKey = typeKey.slice(1, -1);
    }

    const currency = normalizeCurrency(match[2]);
    const metric = match[3] as keyof ByTypeBucket;
    const num = Math.trunc(Number(value ?? 0)) || 0;

    if (!out[typeKey]) out[typeKey] = { CRC: {}, USD: {} } as any;
    if (!out[typeKey][currency]) out[typeKey][currency] = {};
    out[typeKey][currency][metric] = num;
  });

  return out;
};

const normalizeCurrency = (value: unknown): ReporteMovimientoCurrency =>
  value === "USD" ? "USD" : "CRC";

export class ReportesMovimientosService {
  static async listDailyReports(opts: {
    fromDate: string;
    toDate: string;
    empresa?: string;
    empresas?: string[];
    accountIds?: string[];
  }): Promise<ReporteMovimientosDailyDoc[]> {
    const constraints: QueryConstraint[] = [
      where("date", ">=", opts.fromDate),
      where("date", "<=", opts.toDate),
    ];

    const empresas = (opts.empresas || []).map((v) => String(v).trim()).filter(Boolean);
    if (opts.empresa) {
      constraints.push(where("empresa", "==", opts.empresa));
    } else if (empresas.length === 1) {
      constraints.push(where("empresa", "==", empresas[0]));
    } else if (empresas.length > 1) {
      constraints.push(where("empresa", "in", empresas.slice(0, 30)));
    }

    const accountIds = (opts.accountIds || []).filter(Boolean);
    if (accountIds.length === 1) {
      constraints.push(where("accountId", "==", accountIds[0]));
    } else if (accountIds.length > 1) {
      constraints.push(where("accountId", "in", accountIds.slice(0, 10)));
    }

    constraints.push(orderBy("date", "asc"));

    const q = query(collection(db, "reportes_movimientos"), ...constraints);
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const rawByType = (data as any).byType;
      const byType: ByTypeMap = isPlainObject(rawByType)
        ? (rawByType as any)
        : extractByTypeFromFlattenedKeys(data);
      return {
        id: d.id,
        ...(data as any),
        byType: (byType || {}) as any,
      };
    });
  }

  static async listDetailItems(opts: {
    fromIso: string;
    toExclusiveIso: string;
    empresa?: string;
    empresas?: string[];
    accountIds?: string[];
    currency: ReporteMovimientoCurrency;
    classification?: ReporteMovimientoClassification;
    paymentType?: string;
  }): Promise<ReporteMovimientosDetailItem[]> {
    const constraints: QueryConstraint[] = [
      where("createdAt", ">=", opts.fromIso),
      where("createdAt", "<", opts.toExclusiveIso),
      where("currency", "==", normalizeCurrency(opts.currency)),
    ];

    const empresas = (opts.empresas || []).map((v) => String(v).trim()).filter(Boolean);
    if (opts.empresa) {
      constraints.push(where("empresa", "==", opts.empresa));
    } else if (empresas.length === 1) {
      constraints.push(where("empresa", "==", empresas[0]));
    } else if (empresas.length > 1) {
      constraints.push(where("empresa", "in", empresas.slice(0, 30)));
    }

    const accountIds = (opts.accountIds || []).filter(Boolean);
    if (accountIds.length === 1) {
      constraints.push(where("accountId", "==", accountIds[0]));
    } else if (accountIds.length > 1) {
      constraints.push(where("accountId", "in", accountIds.slice(0, 10)));
    }

    if (opts.classification) {
      constraints.push(where("classification", "==", opts.classification));
    }

    if (opts.paymentType) {
      constraints.push(where("paymentType", "==", opts.paymentType));
    }

    constraints.push(orderBy("createdAt", "asc"));

    const q = query(collectionGroup(db, "items"), ...constraints);
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data() as Omit<ReporteMovimientosDetailItem, "id">;
      return {
        id: d.id,
        ...data,
        currency: normalizeCurrency(data.currency),
        amountIngreso: Math.trunc(Number(data.amountIngreso ?? 0)) || 0,
        amountEgreso: Math.trunc(Number(data.amountEgreso ?? 0)) || 0,
      };
    });
  }
}
